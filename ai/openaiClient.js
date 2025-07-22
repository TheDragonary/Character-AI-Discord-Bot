const OpenAI = require('openai');

function convertHistory(rows) {
    return rows.map(row => ({
        role: row.role === 'user' ? 'user' : 'assistant',
        content: row.content
    }));
}

async function getOpenAIResponse({ model, prompt, systemPrompt, description, personality, scenario, mes_example, historyRows }, baseURL, apiKey) {
    const openai = new OpenAI({ baseURL, apiKey });

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
        temperature: 0.7
    };

    // console.log('\nOpenAI API request:', JSON.stringify(payload, null, 2));
    console.log('\nOpenAI API request');
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

module.exports = { getOpenAIResponse };