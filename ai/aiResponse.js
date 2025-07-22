const { getGoogleResponse } = require('./googleClient');
const { getOpenAIResponse } = require('./openaiClient');
const { getLocalResponse } = require('./localClient');
const db = require('../db');

function detectProviderFromModel(model) {
    const lower = model?.toLowerCase() || '';
    if (lower.includes('koboldcpp')) return 'local';
    if (lower.includes('gpt')) return 'openai';
    if (lower.includes('gemini') || lower.includes('gemma')) return 'google';
    if (lower.includes('mistral')) return 'openai';
    if (lower.includes('deepseek')) return 'deepseek';

    return null;
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
            res = await getOpenAIResponse(args);
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