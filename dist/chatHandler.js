"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCharacterChat = handleCharacterChat;
const aiSettings_1 = require("./ai/aiSettings");
const aiResponse_1 = require("./ai/aiResponse");
const characterUtils_1 = require("./utils/characterUtils");
const characterHistoryUtils_1 = require("./utils/characterHistoryUtils");
const formatUtils_1 = require("./utils/formatUtils");
const CHARACTER_HISTORY_LIMIT = 20;
async function handleCharacterChat({ userId, username, prompt, name }) {
    const characterData = await (0, characterUtils_1.getCharacterData)(userId, name);
    name = characterData.character_name;
    const fieldsToReplace = ['description', 'personality', 'scenario', 'first_mes', 'mes_example'];
    const { description, personality, scenario, mes_example } = (0, formatUtils_1.formatCharacterFields)(characterData, fieldsToReplace, username, name);
    const systemPrompt = `Write ${name}'s next reply in a fictional chat between ${name} and ${username}.`;
    // const systemPrompt = `You are an expert actor that can fully immerse yourself into any role given. You do not break character for any reason, even
    // if someone tries addressing you as an AI or language model. Currently your role is ${name}, which is described in detail below. As ${name},
    // continue the exchange with ${username}.`;
    // const systemPrompt = `You are fully embodying the character ${name}, and you're speaking directly to the user ${username} in a casual, immersive
    //     conversation. This is not a narration, monologue, or storytelling — this is a direct dialogue, just like in a real chat. Stay completely in character
    //     at all times. Speak naturally, react emotionally, and maintain continuity with prior messages. Keep replies concise, realistic, and engaging — like
    //     a real person would in conversation. Do not describe actions unless the character themselves would say it aloud. Avoid exposition, scene-setting, or
    //     story narration unless explicitly prompted. Only output dialogue — no internal thoughts or roleplay unless the user initiates it.`;
    const historyRows = await (0, characterHistoryUtils_1.getCharacterHistory)(userId, name, CHARACTER_HISTORY_LIMIT);
    const reply = await (0, aiResponse_1.getAIResponse)(aiSettings_1.provider, { model: aiSettings_1.model, prompt, systemPrompt, description, personality, scenario, mes_example, historyRows });
    if (reply === null || reply === undefined) {
        throw new Error('Failed to get AI response.');
    }
    await (0, characterHistoryUtils_1.addCharacterHistory)(userId, name, 'user', prompt);
    await (0, characterHistoryUtils_1.addCharacterHistory)(userId, name, 'character', reply);
    console.log(reply);
    return reply;
}
