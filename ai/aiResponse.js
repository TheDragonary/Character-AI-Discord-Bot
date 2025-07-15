const { getGoogleResponse } = require('./googleClient');
const { getOpenAIResponse } = require('./openaiClient');

async function getAIResponse(provider, ...args) {
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