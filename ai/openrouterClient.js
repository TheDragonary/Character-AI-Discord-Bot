const OpenAI = require('openai');
const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        'HTTP-Referer': 'https://chaicafe.me/',
        'X-Title': 'Ch.ai Cafe'
    }
});

const allowedModels = [
    'deepseek/deepseek-chat-v3-0324:free',
    'deepseek/deepseek-r1-0528:free',
    'tngtech/deepseek-r1t2-chimera:free',
    'google/gemini-2.0-flash-exp:free',
    'mistralai/mistral-nemo:free',
];

function convertHistory(rows) {
    return rows.map(row => ({
        role: row.role === 'user' ? 'user' : 'assistant',
        content: row.content
    }));
}

async function getOpenRouterResponse({ model, prompt, systemPrompt, description, personality, scenario, mes_example, historyRows }) {
    if (!allowedModels.includes(model)) {
        throw new Error(`Model "${model}" is not allowed via OpenRouter`);
    }

    const systemParts = [
        systemPrompt,
        description,
        personality,
        scenario,
        ...(mes_example ? ['[Example Chat]', mes_example] : []),
        '[Start a new Chat]'
    ].filter(Boolean);

    const payload = {
        model,
        messages: [
            { role: "system", content: systemParts.join('\n\n') },
            ...convertHistory(historyRows),
            { role: "user", content: prompt }
        ],
        temperature: 0.9
    };

    console.log('\nOpenRouter API request');
    const response = await openai.chat.completions.create(payload);

    const inputTokens = response.usage.prompt_tokens ?? 0;
    const outputTokens = response.usage.completion_tokens ?? 0;
    const totalTokens = response.usage.total_tokens ?? inputTokens + outputTokens;

    return {
        content: response.choices[0].message.content,
        usage: {
            inputTokens,
            outputTokens,
            totalTokens
        }
    };
}

module.exports = { getOpenRouterResponse };