"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchCharacter = fetchCharacter;
exports.getCharacterData = getCharacterData;
exports.getFirstMessage = getFirstMessage;
exports.checkCharacterList = checkCharacterList;
exports.getUserCharacterList = getUserCharacterList;
exports.getGlobalCharacterList = getGlobalCharacterList;
exports.getCharacterLists = getCharacterLists;
exports.addCharacter = addCharacter;
exports.deleteCharacter = deleteCharacter;
exports.characterExists = characterExists;
exports.promoteCharacterToGlobal = promoteCharacterToGlobal;
exports.restoreArchivedCharacter = restoreArchivedCharacter;
exports.getMetadata = getMetadata;
const db_1 = __importDefault(require("../db"));
const cardReader_1 = require("../cardReader");
const formatUtils_1 = require("./formatUtils");
async function fetchCharacter(userId, name, fields = '*') {
    const { rows } = await db_1.default.query(`SELECT ${fields} FROM characters 
        WHERE character_name = $1 AND (user_id = $2 OR user_id IS NULL)
        ORDER BY user_id NULLS LAST
        LIMIT 1`, [name, userId]);
    return rows[0] || null;
}
async function getCharacterData(userId, name) {
    const character = await fetchCharacter(userId, name);
    if (!character)
        throw new Error(`Character "${name}" not found.`);
    return character;
}
async function getFirstMessage(userId, username, name) {
    const character = await fetchCharacter(userId, name, 'first_mes');
    if (!character)
        throw new Error(`Character "${name}" not found for user ${userId}.`);
    const { first_mes } = (0, formatUtils_1.formatCharacterFields)(character, ['first_mes'], username, name);
    return first_mes;
}
async function checkCharacterList(userId, name) {
    const character = await fetchCharacter(userId, name, 'user_id');
    if (!character)
        return null;
    return {
        isGlobal: character.user_id === null,
        message: character.user_id === null ? `${name} is already in the global character list.` : `${name} is already in your character list.`
    };
}
async function getUserCharacterList(userId) {
    if (!userId)
        return [];
    const { rows } = await db_1.default.query('SELECT character_name FROM characters WHERE user_id = $1 ORDER BY character_name', [userId]);
    return rows;
}
async function getGlobalCharacterList() {
    const { rows } = await db_1.default.query('SELECT character_name FROM characters WHERE user_id IS NULL ORDER BY character_name', []);
    return rows;
}
async function getCharacterLists(userId) {
    return {
        user: (0, formatUtils_1.formatCharacterList)(await getUserCharacterList(userId)),
        global: (0, formatUtils_1.formatCharacterList)(await getGlobalCharacterList())
    };
}
async function addCharacter(userId, metadata, avatar_url) {
    const { name, description, personality, scenario, first_mes, mes_example } = (0, formatUtils_1.normaliseMetadata)(metadata);
    const result = await checkCharacterList(userId, name);
    if (result)
        throw new Error(result.message);
    await db_1.default.query(`INSERT INTO characters 
        (user_id, character_name, description, personality, scenario, first_mes, mes_example, avatar_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [userId, name, description, personality, scenario, first_mes, mes_example, avatar_url]);
}
async function deleteCharacter(userId, name) {
    const character = await fetchCharacter(userId, name, 'user_id');
    if (!character)
        throw new Error(`No character named **${name}** found in your list.`);
    if (character.user_id === null)
        throw new Error(`You cannot delete **${name}** from the global character list.`);
    await db_1.default.query('DELETE FROM characters WHERE user_id = $1 AND character_name = $2', [userId, name]);
    return `🗑️ Deleted **${name}** from your character list.`;
}
async function characterExists(name, globalOnly = false) {
    const condition = globalOnly ? 'user_id IS NULL' : 'TRUE';
    const { rows } = await db_1.default.query(`SELECT 1 FROM characters WHERE character_name = $1 AND ${condition} LIMIT 1`, [name]);
    return rows.length > 0;
}
async function promoteCharacterToGlobal(name, userId, avatar_url) {
    const { rows } = await db_1.default.query(`SELECT * FROM characters WHERE character_name = $1 AND user_id = $2 LIMIT 1`, [name, userId]);
    if (!rows.length)
        throw new Error(`Character **${name}** not found in your list.`);
    const personal = rows[0];
    const exists = await characterExists(name, true);
    if (exists) {
        throw new Error(`A global character named **${name}** already exists.`);
    }
    await db_1.default.query(`INSERT INTO character_archive (user_id, character_name, description, personality, scenario, first_mes, mes_example, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [personal.user_id, personal.character_name, personal.description, personal.personality, personal.scenario, personal.first_mes, personal.mes_example, personal.avatar_url]);
    await db_1.default.query('DELETE FROM characters WHERE character_name = $1 AND user_id = $2', [name, userId]);
    await db_1.default.query(`INSERT INTO characters 
         (user_id, character_name, description, personality, scenario, first_mes, mes_example, avatar_url)
         VALUES (NULL, $1, $2, $3, $4, $5, $6, $7)`, [personal.character_name, personal.description, personal.personality,
        personal.scenario, personal.first_mes, personal.mes_example, avatar_url ?? personal.avatar_url]);
    return personal;
}
async function restoreArchivedCharacter(name) {
    const { rows } = await db_1.default.query(`SELECT * FROM character_archive 
         WHERE character_name = $1 
         ORDER BY archived_at DESC LIMIT 1`, [name]);
    if (!rows.length)
        return false;
    const archived = rows[0];
    await db_1.default.query(`INSERT INTO characters 
         (user_id, character_name, description, personality, scenario, first_mes, mes_example, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [archived.user_id, archived.character_name, archived.description, archived.personality,
        archived.scenario, archived.first_mes, archived.mes_example, archived.avatar_url]);
    await db_1.default.query('DELETE FROM character_archive WHERE id = $1', [archived.id]);
    return true;
}
async function getMetadata(card, personalCharacterName, userId) {
    let metadata;
    let imageUrl;
    if (card) {
        metadata = await (0, cardReader_1.extractImageData)(card.url);
        imageUrl = card.url;
    }
    else {
        const { rows } = await db_1.default.query(`SELECT * FROM characters WHERE character_name = $1 AND user_id = $2 LIMIT 1`, [personalCharacterName, userId]);
        if (!rows.length) {
            throw new Error(`Personal character **${personalCharacterName}** not found.`);
        }
        metadata = rows[0];
        imageUrl = metadata.avatar_url;
    }
    const normalised = (0, formatUtils_1.normaliseMetadata)(metadata);
    if (!normalised.name) {
        throw new Error('Character name is missing or invalid.');
    }
    return { metadata: normalised, imageUrl, isPromotion: !card };
}
