const db = require('../db');
const { resolveCharacterName } = require('./characterUtils');

async function getCharacterHistory(userId, name, limit = 10) {
    name = await resolveCharacterName(userId, name);
    const { rows } = await db.query(
        `SELECT role, content FROM character_history 
        WHERE user_id = $1 AND character_name = $2 
        ORDER BY timestamp DESC LIMIT $3`,
        [userId, name, limit]
    );
    return rows;
}

async function addCharacterHistory(userId, name, role, content) {
    name = await resolveCharacterName(userId, name);
    await db.query('INSERT INTO character_history (user_id, character_name, role, content) VALUES ($1, $2, $3, $4)', [userId, name, role, content]);
}

async function addCharacterHistoryPair(userId, name, prompt, reply) {
    name = await resolveCharacterName(userId, name);
    await db.query(
        `INSERT INTO character_history (user_id, character_name, role, content)
         VALUES ($1, $2, 'user', $3), ($1, $2, 'character', $4)`,
        [userId, name, prompt, reply]
    );
}

async function pruneCharacterHistory(userId, name, limit = 20) {
    if (!Number.isInteger(limit) || limit < 1) {
        throw new Error('Limit must be a positive integer greater than zero.');
    }
    
    name = await resolveCharacterName(userId, name);
    await db.query(
        `DELETE FROM character_history
         WHERE id IN (
             SELECT id FROM character_history
             WHERE user_id = $1 AND character_name = $2
             ORDER BY timestamp DESC
             OFFSET $3
         )`,
        [userId, name, limit]
    );
}

async function checkHistoryExists(userId, name) {
    name = await resolveCharacterName(userId, name);
    const { rows } = await db.query('SELECT 1 FROM character_history WHERE user_id = $1 AND character_name = $2 LIMIT 1', [userId, name]);
    return rows.length > 0;
}

module.exports = {
    getCharacterHistory,
    addCharacterHistory,
    addCharacterHistoryPair,
    pruneCharacterHistory,
    checkHistoryExists
};