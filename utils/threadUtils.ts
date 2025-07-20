import db from '../db';

export async function getThreadInfo(threadId: string, fields: string = '*') {
    const { rows } = await db.query(
        `SELECT ${fields} FROM character_threads WHERE thread_id = $1`,
        [threadId]
    );
    return rows[0] || null;
}

export async function getDefaultThreadChannel(guildId: string) {
    const { rows } = await db.query(
        `SELECT default_thread_channel_id FROM guild_settings WHERE guild_id = $1`,
        [guildId]
    );
    return rows[0]?.default_thread_channel_id || null;
}

export async function getCharacterIdByName(userId: string, name: string) {
    const { rows } = await db.query(
        `SELECT id FROM characters
         WHERE character_name = $1 AND (user_id = $2 OR user_id IS NULL)
         ORDER BY user_id NULLS LAST
         LIMIT 1`,
        [name, userId]
    );
    if (!rows.length) throw new Error(`Character "${name}" not found.`);
    return rows[0].id;
}

export async function createCharacterThread(threadId: string, guildId: string, userId: string, characterId: string) {
    await db.query(
        `INSERT INTO character_threads (thread_id, guild_id, user_id, character_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (thread_id) DO UPDATE SET character_id = EXCLUDED.character_id`,
        [threadId, guildId, userId, characterId]
    );
}

export async function getThreadCharacter(threadId: string) {
    const { rows } = await db.query(
        `SELECT c.* FROM character_threads ct
         JOIN characters c ON ct.character_id = c.id
         WHERE ct.thread_id = $1`,
        [threadId]
    );
    return rows[0] || null;
}

export async function deleteCharacterThread(threadId: string) {
    await db.query('DELETE FROM character_threads WHERE thread_id = $1', [threadId]);
}
