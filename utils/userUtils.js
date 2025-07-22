const { detectProviderFromModel } = require('../ai/aiResponse');
const db = require('../db');

async function setUserSettings(userId, model) {
    await db.query(
        `INSERT INTO user_settings (user_id, selected_model)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET selected_model = EXCLUDED.selected_model`,
        [userId, model]
    );
}

async function isModelAllowedForTier(tier, model) {
    if (!model) return true;

    const result = await db.query(
        `SELECT 1 FROM tier_model_access
         WHERE tier_name = $1 AND model_name = $2`,
        [tier, model]
    );

    return result.rowCount > 0;
}

async function getUserModelAndTier(userId) {
    const res = await db.query(
        `SELECT ut.tier_name, us.selected_model 
         FROM user_tiers ut
         LEFT JOIN user_settings us ON ut.user_id = us.user_id
         WHERE ut.user_id = $1`,
        [userId]
    );

    let tier = 'free';
    let model = null;

    if (res.rows.length === 0) {
        await db.query(`INSERT INTO user_tiers (user_id, tier_name) VALUES ($1, 'free')`, [userId]);
    } else {
        tier = res.rows[0].tier_name;
        model = res.rows[0].selected_model;
    }

    const allowed = await isModelAllowedForTier(tier, model);
    if (!allowed) {
        await db.query(`UPDATE user_settings SET selected_model = NULL WHERE user_id = $1`, [userId]);
        model = null;
    }

    return { tier, model };
}

async function checkUserLimits(userId, tier, model) {
    const provider = detectProviderFromModel(model);

    if (tier === 'free' && provider === 'local') {
        return { allowed: true, tier };
    }

    const limitsRes = await db.query(
        `SELECT rpm, rpd, tpm, tpd, tpm_month
        FROM tiers
        WHERE tier_name = $1`,
        [tier]
    );

    const limits = limitsRes.rows[0];

    const now = new Date();
    const currentMinute = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
    const currentMonth = now.toISOString().slice(0, 7);   // YYYY-MM

    // Daily limits
    const dayRes = await db.query(
        `SELECT 
            COALESCE(SUM(tokens_used), 0) AS tokens_used,
            COALESCE(SUM(requests_made), 0) AS requests_made
        FROM user_usage
        WHERE user_id = $1 AND last_updated::date = CURRENT_DATE`,
        [userId]
    );

    const { tokens_used: tokensToday, requests_made: requestsToday } = dayRes.rows[0];
    if (tokensToday >= limits.tpd) return { allowed: false, reason: `Daily token limit exceeded (${tokensToday}/${limits.tpd}).` };
    if (requestsToday >= limits.rpd) return { allowed: false, reason: `Daily request limit exceeded (${requestsToday}/${limits.rpd}).` };

    // Per-minute limits
    const minuteRes = await db.query(
        `SELECT 
            COALESCE(SUM(tokens_used), 0) AS tokens_used,
            COALESCE(SUM(requests_made), 0) AS requests_made
        FROM user_usage
        WHERE user_id = $1 AND to_char(last_updated, 'YYYY-MM-DD"T"HH24:MI') = $2`,
        [userId, currentMinute]
    );

    const { tokens_used: tokensThisMinute, requests_made: requestsThisMinute } = minuteRes.rows[0];
    if (tokensThisMinute >= limits.tpm) return { allowed: false, reason: `Per-minute token limit exceeded (${tokensThisMinute}/${limits.tpm}).` };
    if (requestsThisMinute >= limits.rpm) return { allowed: false, reason: `Per-minute request limit exceeded (${requestsThisMinute}/${limits.rpm}).` };

    // Monthly limit
    const monthRes = await db.query(
        `SELECT COALESCE(SUM(tokens_used), 0) AS tokens_used
        FROM user_usage
        WHERE user_id = $1 AND to_char(last_updated, 'YYYY-MM') = $2`,
        [userId, currentMonth]
    );

    const { tokens_used: tokensThisMonth } = monthRes.rows[0];
    if (tokensThisMonth >= limits.tpm_month) return { allowed: false, reason: `Monthly token limit exceeded (${tokensThisMonth}/${limits.tpm_month}).` };

    return { allowed: true, tier };
}

module.exports = { setUserSettings, getUserModelAndTier, checkUserLimits };