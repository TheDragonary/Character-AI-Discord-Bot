const db = require('../db');

async function getUserModel(userId, tierName) {
    const res = await db.query(
        `SELECT selected_model FROM user_settings WHERE user_id = $1`,
        [userId]
    );

    if (res.rowCount === 0 || !res.rows[0].selected_model) return 'local';
    const selected = res.rows[0].selected_model;

    const access = await db.query(
        `SELECT 1 FROM tier_model_access WHERE tier_name = $1 AND model_name = $2`,
        [tierName, selected]
    );

    return access.rowCount > 0 ? selected : 'local';
}

async function incrementUsage(userId, modelName, tokensUsed) {
    await db.query(
        `INSERT INTO user_usage (user_id, model_name, tokens_used)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, model_name)
        DO UPDATE SET tokens_used = user_usage.tokens_used + $3`,
        [userId, modelName, tokensUsed]
    );
}

module.exports = { getUserModel, incrementUsage };