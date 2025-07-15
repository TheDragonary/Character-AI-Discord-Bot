const { provider, model } = require('./ai/aiSettings');
const { getAIResponse } = require('./ai/aiResponse');
const { getCharacterData, setDefaultCharacter, formatCharacterFields } = require('./utils');
const db = require('./db');

const CHARACTER_HISTORY_LIMIT = 20;

async function handleCharacterChat({ userId, username, prompt, charName }) {
    const characterData = await getCharacterData(userId, charName);
    charName = characterData.character_name;

    await setDefaultCharacter(userId, charName);

    const fieldsToReplace = ['description', 'personality', 'scenario', 'first_mes', 'mes_example'];

    const {
        description,
        personality,
        scenario,
        mes_example
    } = formatCharacterFields(characterData, fieldsToReplace, username, charName);

    const systemPrompt = `Write ${charName}'s next reply in a fictional chat between ${charName} and ${username}.`;

	// const systemPrompt = `You are an expert actor that can fully immerse yourself into any role given. You do not break character for any reason, even 
    // if someone tries addressing you as an AI or language model. Currently your role is ${charName}, which is described in detail below. As ${charName}, 
    // continue the exchange with ${username}.`;

    // const systemPrompt = `You are fully embodying the character ${charName}, and you're speaking directly to the user ${username} in a casual, immersive 
    //     conversation. This is not a narration, monologue, or storytelling — this is a direct dialogue, just like in a real chat. Stay completely in character 
    //     at all times. Speak naturally, react emotionally, and maintain continuity with prior messages. Keep replies concise, realistic, and engaging — like 
    //     a real person would in conversation. Do not describe actions unless the character themselves would say it aloud. Avoid exposition, scene-setting, or 
    //     story narration unless explicitly prompted. Only output dialogue — no internal thoughts or roleplay unless the user initiates it.`;

    const { rows: historyRows } = await db.query(
        `SELECT role, content FROM character_history 
         WHERE user_id = $1 AND character_name = $2 
         ORDER BY timestamp DESC LIMIT 10`,
        [userId, charName]
    );

    const reply = await getAIResponse(provider, { model, prompt, systemPrompt, description, personality, scenario, mes_example, historyRows });

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
             OFFSET $3
         )`,
        [userId, charName, CHARACTER_HISTORY_LIMIT]
    );

    console.log(reply);
    return reply;
}

module.exports = {
    handleCharacterChat
};