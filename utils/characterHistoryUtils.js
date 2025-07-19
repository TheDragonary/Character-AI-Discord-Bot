const db = require('../db');

async function getCharacterHistory(userId, name, limit) {
    let query = `
        SELECT role, content FROM character_history
        WHERE user_id = $1 AND character_name = $2
        ORDER BY id ASC
    `;

    const params = [userId, name];

    if (limit && Number.isInteger(limit)) {
        query += ' LIMIT $3';
        params.push(limit);
    }

    const { rows } = await db.query(query, params);
    return rows;
}

async function addCharacterHistory(userId, name, role, content) {
    await db.query('INSERT INTO character_history (user_id, character_name, role, content) VALUES ($1, $2, $3, $4)', [userId, name, role, content]);
}

module.exports = {
    getCharacterHistory,
    addCharacterHistory
};