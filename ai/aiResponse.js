const { getGoogleResponse } = require('./googleClient');
const { getOpenAIResponse } = require('./openaiClient');
const { getLocalResponse } = require('./localClient');
const { getOpenRouterResponse } = require('./openrouterClient');
const openrouterModels = require('../utils/openrouterModels');
const db = require('../db');

const modelProviderMap = {
    local: ['koboldcpp'],
    openai: ['gpt', 'mistral', 'deepseek'],
    google: ['gemini', 'gemma'],
};

function detectProviderFromModel(model) {
    const lower = model?.toLowerCase() || '';

     if (openrouterModels.some(m => m.model_name.toLowerCase() === lower)) return 'openrouter';

    for (const [provider, keywords] of Object.entries(modelProviderMap)) {
        if (keywords.some(keyword => lower.includes(keyword))) return provider;
    }

    return null;
}

const openAIModelConfigMap = [
    {
        keywords: ['gpt'],
        baseURL: 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY
    },
    {
        keywords: ['mistral'],
        baseURL: 'https://api.mistral.ai/v1',
        apiKey: process.env.MISTRAL_API_KEY
    },
    {
        keywords: ['deepseek'],
        baseURL: 'https://api.deepseek.com/v1',
        apiKey: process.env.DEEPSEEK_API_KEY
    }
];

function getOpenAIConfigForModel(model) {
    const lower = model.toLowerCase();

    for (const config of openAIModelConfigMap) {
        if (config.keywords.some(k => lower.includes(k))) {
            return {
                baseURL: config.baseURL,
                apiKey: config.apiKey
            };
        }
    }

    throw new Error('Unknown OpenAI-compatible model or missing config');
}

async function getAIResponse({ userId, tier, model, prompt, systemPrompt, description, personality, scenario, mes_example, historyRows }) {
    const provider = detectProviderFromModel(model);
    if (!provider) throw new Error(`Unknown provider for model: ${model}`);

    const args = {
        model,
        prompt,
        systemPrompt,
        description,
        personality,
        scenario,
        mes_example,
        historyRows
    };

    let res;
    switch (provider) {
        case 'local':
            res = await getLocalResponse(args);
            break;
        case 'google':
            res = await getGoogleResponse(args);
            break;
        case 'openai':
            const { baseURL, apiKey } = getOpenAIConfigForModel(model);
            res = await getOpenAIResponse(args, baseURL, apiKey);
            break;
        case 'openrouter':
            res = await getOpenRouterResponse(args);
            break;
        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }

    console.log(`Model: ${model}`);

    if (res.usage) {
        const { inputTokens, outputTokens, totalTokens } = res.usage;
        console.log(`[Token Usage] Input: ${inputTokens} | Output: ${outputTokens} | Total: ${totalTokens}`);
    }

    if (res.usage?.totalTokens && model) {
        const usedTokens = res.usage.totalTokens;
        const now = new Date();

        if (!(tier === 'free' && provider === 'local')) {
            await db.query(
                `INSERT INTO user_usage (user_id, model_name, tokens_used, requests_made, last_updated)
                VALUES ($1, $2, $3, 1, $4)
                ON CONFLICT (user_id, model_name)
                DO UPDATE SET 
                    tokens_used = user_usage.tokens_used + $3,
                    requests_made = user_usage.requests_made + 1,
                    last_updated = $4`,
                [userId, model, usedTokens, now]
            );
        }
    }

    return res.content;
}

module.exports = { detectProviderFromModel, getAIResponse };