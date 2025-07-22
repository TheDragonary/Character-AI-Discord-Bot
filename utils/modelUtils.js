const openrouterModels = require('./openrouterModels');
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

async function syncOpenRouterModels() {
    for (const model of openrouterModels) {
        await db.query(
            `INSERT INTO models (model_name, display_name, provider, input_cost, output_cost)
             VALUES ($1, $2, 'OpenRouter', $3, $4)
             ON CONFLICT (model_name) DO UPDATE SET display_name = EXCLUDED.display_name`,
            [model.model_name, model.display_name, model.input_cost, model.output_cost]
        );
    }

    const modelNames = openrouterModels.map(m => m.model_name);
    await db.query(
        `DELETE FROM models WHERE provider = 'OpenRouter' AND model_name NOT IN (${modelNames.map((_, i) => '$' + (i+1)).join(',')})`,
        modelNames
    );
}

async function syncTierModelAccess() {
    for (const model of openrouterModels) {
        for (const tier of model.tiers) {
            await db.query(
                `INSERT INTO tier_model_access (tier_name, model_name)
                 VALUES ($1, $2)
                 ON CONFLICT DO NOTHING`,
                [tier, model.model_name]
            );
        }
    }

    const validPairs = new Set();
    for (const model of openrouterModels) {
        for (const tier of model.tiers) {
            validPairs.add(`${tier}||${model.model_name}`);
        }
    }

    const res = await db.query(
        `SELECT tier_name, model_name FROM tier_model_access
         WHERE model_name IN (${openrouterModels.map((_, i) => '$' + (i + 1)).join(',')})`,
        openrouterModels.map(m => m.model_name)
    );

    for (const row of res.rows) {
        const key = `${row.tier_name}||${row.model_name}`;
        if (!validPairs.has(key)) {
            await db.query(
                `DELETE FROM tier_model_access WHERE tier_name = $1 AND model_name = $2`,
                [row.tier_name, row.model_name]
            );
        }
    }
}

module.exports = { getUserModel, incrementUsage, syncOpenRouterModels, syncTierModelAccess };