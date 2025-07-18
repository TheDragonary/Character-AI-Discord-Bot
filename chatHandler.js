const { provider, model } = require('./ai/aiSettings');
const { getAIResponse } = require('./ai/aiResponse');
const { getCharacterData } = require('./utils/characterUtils');
const { getCharacterHistory, addCharacterHistory } = require('./utils/characterHistoryUtils');
const { formatCharacterFields } = require('./utils/formatUtils');
const db = require('./db');

const CHARACTER_HISTORY_LIMIT = 20;

async function handleCharacterChat({ userId, username, prompt, name }) {
    const characterData = await getCharacterData(userId, name);
    name = characterData.character_name;

    const fieldsToReplace = ['description', 'personality', 'scenario', 'first_mes', 'mes_example'];

    const {
        description,
        personality,
        scenario,
        mes_example
    } = formatCharacterFields(characterData, fieldsToReplace, username, name);

    const systemPrompt = `Write ${name}'s next reply in a fictional chat between ${name} and ${username}.`;

	// const systemPrompt = `You are an expert actor that can fully immerse yourself into any role given. You do not break character for any reason, even 
    // if someone tries addressing you as an AI or language model. Currently your role is ${name}, which is described in detail below. As ${name}, 
    // continue the exchange with ${username}.`;

    // const systemPrompt = `You are fully embodying the character ${name}, and you're speaking directly to the user ${username} in a casual, immersive 
    //     conversation. This is not a narration, monologue, or storytelling — this is a direct dialogue, just like in a real chat. Stay completely in character 
    //     at all times. Speak naturally, react emotionally, and maintain continuity with prior messages. Keep replies concise, realistic, and engaging — like 
    //     a real person would in conversation. Do not describe actions unless the character themselves would say it aloud. Avoid exposition, scene-setting, or 
    //     story narration unless explicitly prompted. Only output dialogue — no internal thoughts or roleplay unless the user initiates it.`;

    const historyRows = await getCharacterHistory(userId, name, CHARACTER_HISTORY_LIMIT);

    const reply = await getAIResponse(provider, { model, prompt, systemPrompt, description, personality, scenario, mes_example, historyRows });

    await addCharacterHistory(userId, name, 'user', prompt);
    await addCharacterHistory(userId, name, 'character', reply);

    console.log(reply);
    return reply;
}

module.exports = {
    handleCharacterChat
};