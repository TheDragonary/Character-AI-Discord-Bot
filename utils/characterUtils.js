const db = require('../db');
const { formatCharacterFields, normaliseMetadata, formatCharacterList } = require('./formatUtils');

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

async function setDefaultCharacter(userId, name) {
    await db.query(
        `INSERT INTO user_settings (user_id, default_character)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET default_character = EXCLUDED.default_character`,
        [userId, name]
    );
}

async function resolveCharacterName(userId, name) {
    if (!name) {
        if (!userId) {
            throw new Error('Cannot resolve character name without a user ID.');
        }
        return await getDefaultCharacter(userId);
    }
    return name;
}

async function fetchCharacter(userId, name, fields = '*') {
    name = await resolveCharacterName(userId, name);
    const { rows } = await db.query(
        `SELECT ${fields} FROM characters 
        WHERE character_name = $1 AND (user_id = $2 OR user_id IS NULL)
        ORDER BY user_id NULLS LAST
        LIMIT 1`,
        [name, userId]
    );
    return rows[0] || null;
}

async function getCharacterData(userId, name) {
    name = await resolveCharacterName(userId, name);
    const character = await fetchCharacter(userId, name);
    if (!character) throw new Error(`Character "${name}" not found.`);
    return character;
}

async function getFirstMessage(userId, username, name) {
    name = await resolveCharacterName(userId, name);
    const character = await fetchCharacter(userId, name, 'first_mes');
    if (!character) throw new Error(`Character "${name}" not found for user ${userId}.`);
    await setDefaultCharacter(userId, name);
    const { first_mes } = formatCharacterFields(character, ['first_mes'], username, name);
    return first_mes;
}

async function checkCharacterList(userId, name) {
    const character = await fetchCharacter(userId, name, 'user_id');
    if (!character) return null;

    return {
        isGlobal: character.user_id === null,
        message: character.user_id === null ? `${name} is already in the global character list.` : `${name} is already in your character list.`
    };
}

async function getUserCharacterList(userId) {
    if (!userId) return [];
    const { rows } = await db.query(
        'SELECT character_name FROM characters WHERE user_id = $1 ORDER BY character_name',
        [userId]
    );
    return rows;
}

async function getGlobalCharacterList() {
    const { rows } = await db.query(
        'SELECT character_name FROM characters WHERE user_id IS NULL ORDER BY character_name'
    );
    return rows;
}
    
async function getCharacterLists(userId) {
    const userList = formatCharacterList(await getUserCharacterList(userId));
    const globalList = formatCharacterList(await getGlobalCharacterList());
    return { userList, globalList };
}

async function addCharacter(userId, metadata, avatar_url) {
    const { name, description, personality, scenario, first_mes, mes_example } = normaliseMetadata(metadata);
    const result = await checkCharacterList(userId, name);
    if (result) throw new Error(result.message);

    await db.query(
        `INSERT INTO characters 
        (user_id, character_name, description, personality, scenario, first_mes, mes_example, avatar_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, name, description, personality, scenario, first_mes, mes_example, avatar_url]
    );
}

async function deleteCharacter(userId, name) {
    const character = await fetchCharacter(userId, name, 'user_id');
    if (!character) throw new Error(`No character named **${name}** found in your list.`);
    if (character.user_id === null) throw new Error(`You cannot delete **${name}** from the global character list.`)

    await db.query(
        'DELETE FROM characters WHERE user_id = $1 AND character_name = $2',
        [userId, name]
    );

    return `🗑️ Deleted **${name}** from your character list.`;
}

module.exports = {
    getDefaultCharacter,
    setDefaultCharacter,
    resolveCharacterName,
    fetchCharacter,
    getCharacterData,
    getFirstMessage,
    checkCharacterList,
    getUserCharacterList,
    getGlobalCharacterList,
    getCharacterLists,
    addCharacter,
    deleteCharacter
};