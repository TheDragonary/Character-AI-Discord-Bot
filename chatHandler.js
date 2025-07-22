const { getAIResponse } = require('./ai/aiResponse');
const { getCharacterData } = require('./utils/characterUtils');
const { getCharacterHistory, addCharacterHistory } = require('./utils/characterHistoryUtils');
const { formatCharacterFields } = require('./utils/formatUtils');
const { getUserModelAndTier, checkUserLimits } = require('./utils/userUtils');
const { isLocalRunning } = require('./ai/localClient');

const CHARACTER_HISTORY_LIMIT = 20;

async function handleCharacterChat({ userId, username, prompt, name }) {
    const { tier, model: userModel } = await getUserModelAndTier(userId);
    const model = userModel || (await isLocalRunning() ? 'koboldcpp' : 'gemma-3-27b-it');

    const limitCheck = await checkUserLimits(userId, tier, model);
    if (!limitCheck.allowed) throw new Error(limitCheck.reason);

    const characterData = await getCharacterData(userId, name);
    name = characterData.character_name;

    const fieldsToReplace = ['description', 'personality', 'scenario', 'first_mes', 'mes_example'];

    const {
        description,
        personality,
        scenario,
        first_mes,
        mes_example
    } = formatCharacterFields(characterData, fieldsToReplace, username, name);

    if (await getCharacterHistory(userId, name, 1).then(res => res.length === 0)) {
        await addCharacterHistory(userId, name, 'character', first_mes);
        return first_mes;
    }

    const systemPrompt = `Write ${name}'s next reply in a fictional chat between ${name} and ${username}.`;

    const historyRows = await getCharacterHistory(userId, name, CHARACTER_HISTORY_LIMIT);

    const reply = await getAIResponse({ userId, tier, model, prompt, systemPrompt, description, personality, scenario, mes_example, historyRows });

    await addCharacterHistory(userId, name, 'user', prompt);
    await addCharacterHistory(userId, name, 'character', reply);

    console.log(reply);
    return reply;
}

module.exports = { handleCharacterChat };