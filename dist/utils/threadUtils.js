"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getThreadInfo = getThreadInfo;
exports.getDefaultThreadChannel = getDefaultThreadChannel;
exports.getCharacterIdByName = getCharacterIdByName;
exports.createCharacterThread = createCharacterThread;
exports.getThreadCharacter = getThreadCharacter;
exports.deleteCharacterThread = deleteCharacterThread;
const db_1 = __importDefault(require("../db"));
async function getThreadInfo(threadId, fields = '*') {
    const { rows } = await db_1.default.query(`SELECT ${fields} FROM character_threads WHERE thread_id = $1`, [threadId]);
    return rows[0] || null;
}
async function getDefaultThreadChannel(guildId) {
    const { rows } = await db_1.default.query(`SELECT default_thread_channel_id FROM guild_settings WHERE guild_id = $1`, [guildId]);
    return rows[0]?.default_thread_channel_id || null;
}
async function getCharacterIdByName(userId, name) {
    const { rows } = await db_1.default.query(`SELECT id FROM characters
         WHERE character_name = $1 AND (user_id = $2 OR user_id IS NULL)
         ORDER BY user_id NULLS LAST
         LIMIT 1`, [name, userId]);
    if (!rows.length)
        throw new Error(`Character "${name}" not found.`);
    return rows[0].id;
}
async function createCharacterThread(threadId, guildId, userId, characterId) {
    await db_1.default.query(`INSERT INTO character_threads (thread_id, guild_id, user_id, character_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (thread_id) DO UPDATE SET character_id = EXCLUDED.character_id`, [threadId, guildId, userId, characterId]);
}
async function getThreadCharacter(threadId) {
    const { rows } = await db_1.default.query(`SELECT c.* FROM character_threads ct
         JOIN characters c ON ct.character_id = c.id
         WHERE ct.thread_id = $1`, [threadId]);
    return rows[0] || null;
}
async function deleteCharacterThread(threadId) {
    await db_1.default.query('DELETE FROM character_threads WHERE thread_id = $1', [threadId]);
}
