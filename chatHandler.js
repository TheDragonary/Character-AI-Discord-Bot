const { provider, model } = require('./aiSettings');
const { getAIResponse } = require('./aiResponse');
const db = require('./db');

async function getCharacterData(userId, charName) {
    if (!charName) {
        const { rows } = await db.query(
            'SELECT default_character FROM user_settings WHERE user_id = $1',
            [userId]
        );
        if (!rows.length || !rows[0].default_character) {
            throw new Error('No character specified and no default character set.');
        }
        charName = rows[0].default_character;
    }

    const { rows } = await db.query(
        `SELECT * FROM characters 
        WHERE character_name = $1 AND (user_id = $2 OR user_id IS NULL)
        ORDER BY user_id NULLS LAST
        LIMIT 1`,
        [charName, userId]
    );

    if (rows.length === 0) {
        throw new Error(`Character "${charName}" not found.`);
    }

    await db.query(`
        INSERT INTO user_settings (user_id, default_character)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET default_character = EXCLUDED.default_character`,
        [userId, charName]
    );

    return rows[0];
}

async function handleCharacterChat({ userId, username, prompt, charName }) {
    const characterData = await getCharacterData(userId, charName);
    charName = characterData.character_name;

    const safeReplace = (str) =>
        str.replace(/\{\{user\}\}/gi, username).replace(/\{\{char\}\}/gi, charName);

    const description = safeReplace(characterData.description || '');
    const personality = safeReplace(characterData.personality || '');
    const scenario = safeReplace(characterData.scenario || '');
    const first_mes = safeReplace(characterData.first_mes || '');
    const mes_example = safeReplace(characterData.mes_example || '');

    // const systemPrompt = `Write ${charName}'s next reply in a fictional chat between ${charName} and ${username}.`;

	const systemPrompt = `You are an expert actor that can fully immerse yourself into any role given. You do not break character for any reason, even 
    if someone tries addressing you as an AI or language model. Currently your role is ${charName}, which is described in detail below. As ${charName}, 
    continue the exchange with ${username}.`;

    const { rows: historyRows } = await db.query(
        `SELECT role, content FROM character_history 
         WHERE user_id = $1 AND character_name = $2 
         ORDER BY timestamp DESC LIMIT 10`,
        [userId, charName]
    );

    const reply = await getAIResponse(provider, model, prompt, systemPrompt, description, personality, scenario, first_mes, mes_example, historyRows);

    await db.query(
        `INSERT INTO character_history (user_id, character_name, role, content)
         VALUES ($1, $2, 'user', $3), ($1, $2, 'character', $4)`,
        [userId, charName, prompt, reply]
    );

    await db.query(
        `DELETE FROM character_history
         WHERE id IN (
             SELECT id FROM character_history
             WHERE user_id = $1 AND character_name = $2
             ORDER BY timestamp DESC
             OFFSET 20
         )`,
        [userId, charName]
    );

    console.log(reply);
    return reply;
}

function splitMessage(text, limit = 2000) {
    const lines = text.split('\n');
    const chunks = [];
    let current = '';

    for (const line of lines) {
        if ((current + line).length > limit) {
            if (current) chunks.push(current);
            current = '';
        }
        current += line + '\n';
    }

    if (current) chunks.push(current);
    return chunks;
}

module.exports = {
    handleCharacterChat,
    splitMessage
};