const { getGoogleResponse } = require('./googleClient');
const { getOpenAIResponse } = require('./openaiClient');
const { isLocalRunning, getLocalResponse } = require('./localClient');

async function getAIResponse(provider, ...args) {
    if (await isLocalRunning()) return await getLocalResponse(...args);

    switch (provider) {
        case 'google':
            return await getGoogleResponse(...args);
        case 'openai':
            return await getOpenAIResponse(...args);
        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }
}

module.exports = { getAIResponse };