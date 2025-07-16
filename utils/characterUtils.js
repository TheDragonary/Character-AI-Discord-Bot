const db = require('../db');
const { extractImageData } = require('../cardReader');
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
    return {
        user: formatCharacterList(await getUserCharacterList(userId)),
        global: formatCharacterList(await getGlobalCharacterList())
    };
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

async function characterExists(name, globalOnly = false) {
    const condition = globalOnly ? 'user_id IS NULL' : 'TRUE';
    const { rows } = await db.query(
        `SELECT 1 FROM characters WHERE character_name = $1 AND ${condition} LIMIT 1`,
        [name]
    );
    return rows.length > 0;
}

async function promoteCharacterToGlobal(name, userId, avatar_url) {
    const { rows } = await db.query(
        `SELECT * FROM characters WHERE character_name = $1 AND user_id = $2 LIMIT 1`,
        [name, userId]
    );
    if (!rows.length) throw new Error(`Character **${name}** not found in your list.`);

    const personal = rows[0];

    const exists = await characterExists(name, true);
    if (exists) {
        throw new Error(`A global character named **${name}** already exists.`);
    }

    await db.query(
        `INSERT INTO character_archive (user_id, character_name, description, personality, scenario, first_mes, mes_example, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [personal.user_id, personal.character_name, personal.description, personal.personality, personal.scenario, personal.first_mes, personal.mes_example, personal.avatar_url]
    );

    await db.query(
        'DELETE FROM characters WHERE character_name = $1 AND user_id = $2',
        [name, userId]
    );

    await db.query(
        `INSERT INTO characters 
         (user_id, character_name, description, personality, scenario, first_mes, mes_example, avatar_url)
         VALUES (NULL, $1, $2, $3, $4, $5, $6, $7)`,
        [personal.character_name, personal.description, personal.personality,
         personal.scenario, personal.first_mes, personal.mes_example, avatar_url ?? personal.avatar_url]
    );

    return personal;
}

async function restoreArchivedCharacter(name) {
    const { rows } = await db.query(
        `SELECT * FROM character_archive 
         WHERE character_name = $1 
         ORDER BY archived_at DESC LIMIT 1`,
        [name]
    );

    if (!rows.length) return false;
    const archived = rows[0];

    await db.query(
        `INSERT INTO characters 
         (user_id, character_name, description, personality, scenario, first_mes, mes_example, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [archived.user_id, archived.character_name, archived.description, archived.personality,
        archived.scenario, archived.first_mes, archived.mes_example, archived.avatar_url]
    );

    await db.query('DELETE FROM character_archive WHERE id = $1', [archived.id]);
    return true;
}

async function getMetadata(card, personalCharacterName, userId) {
    let metadata;
    let imageUrl;

    if (card) {
        metadata = await extractImageData(card.url);
        imageUrl = card.url;
    } else {
        const { rows } = await db.query(
            `SELECT * FROM characters WHERE character_name = $1 AND user_id = $2 LIMIT 1`,
            [personalCharacterName, userId]
        );

        if (!rows.length) {
            throw new Error(`Personal character **${personalCharacterName}** not found.`);
        }

        metadata = rows[0];
        imageUrl = metadata.avatar_url;
    }

    const normalised = normaliseMetadata(metadata);
    if (!normalised.name) {
        throw new Error('Character name is missing or invalid.');
    }

    return { metadata: normalised, imageUrl, isPromotion: !card };
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
    deleteCharacter,
    characterExists,
    promoteCharacterToGlobal,
    restoreArchivedCharacter,
    getMetadata
};