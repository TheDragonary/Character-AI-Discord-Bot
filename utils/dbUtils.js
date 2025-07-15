const db = require('../db');

async function getDefaultCharacter(userId) {
    const { rows } = await db.query(
        'SELECT default_character FROM user_settings WHERE user_id = $1',
        [userId]
    );
    if (!rows.length || !rows[0].default_character) {
        throw new Error('No character specified and no default character set.');
    }
    return rows[0].default_character;
}

async function setDefaultCharacter(userId, charName) {
    await db.query(
        `INSERT INTO user_settings (user_id, default_character)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET default_character = EXCLUDED.default_character`,
        [userId, charName]
    );
}

async function resolveCharacterName(userId, charName) {
    return charName ?? await getDefaultCharacter(userId);
}

async function fetchCharacter(userId, charName, fields = '*') {
    const { rows } = await db.query(
        `SELECT ${fields} FROM characters 
        WHERE character_name = $1 AND (user_id = $2 OR user_id IS NULL)
        ORDER BY user_id NULLS LAST
        LIMIT 1`,
        [charName, userId]
    );
    return rows[0] || null;
}

async function getCharacterData(userId, charName) {
    charName = await resolveCharacterName(userId, charName);
    const character = await fetchCharacter(userId, charName);
    if (!character) throw new Error(`Character "${charName}" not found.`);
    return character;
}

async function getFirstMessage(userId, username, charName) {
    charName = await resolveCharacterName(userId, charName);
    const character = await fetchCharacter(userId, charName, 'first_mes');
    if (!character) throw new Error(`Character "${charName}" not found for user ${userId}.`);
    await setDefaultCharacter(userId, charName);
    const { first_mes } = formatCharacterFields(character, ['first_mes'], username, charName);
    return first_mes;
}

module.exports = {
    getDefaultCharacter,
    setDefaultCharacter,
    resolveCharacterName,
    getCharacterData,
    getFirstMessage
};