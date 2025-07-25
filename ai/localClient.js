const OpenAI = require('openai');
const openai = new OpenAI({ baseURL: "http://localhost:5001/v1", apiKey: "0" });

async function isLocalRunning() {
    try {
        const res = await fetch("http://localhost:5001");
        return res.ok;
    } catch {
        return false;
    }
}

function convertHistory(rows) {
    return rows.map(row => ({
        role: row.role === 'user' ? 'user' : 'assistant',
        content: row.content
    }));
}

async function getLocalResponse({ model, prompt, systemPrompt, description, personality, scenario, mes_example, historyRows }) {
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
        temperature: 1.0
    };

    // console.log('\nLocal API request:', JSON.stringify(payload, null, 2));
    console.log('\nLocal API request');
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

module.exports = { isLocalRunning, getLocalResponse };