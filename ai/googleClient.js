const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({});

function convertHistory(rows) {
    return rows.map(row => ({
        role: row.role === 'user' ? 'user' : 'model',
        parts: [{ text: row.content }]
    }));
}

async function getGoogleResponse({ model, prompt, systemPrompt, description, personality, scenario, mes_example, historyRows }) {
    const contents = [
        ...convertHistory(historyRows),
        { role: 'user', parts: [{ text: prompt }] }
    ];

    const systemParts = [
        { text: systemPrompt },
        ...(description ? [{ text: description }] : []),
        ...(personality ? [{ text: personality }] : []),
        ...(scenario ? [{ text: scenario }] : []),
        ...(mes_example ? [{ text: '[Example Chat]' }, { text: mes_example }] : []),
        { text: '[Start a new Chat]' }
    ];

    const payload = {
        model,
        contents,
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
            { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'OFF' }
        ],
        generationConfig: {
            temperature: 1.0
        },
        systemInstruction: { parts: systemParts }
    };

    // console.log('\nGoogle AI Studio request:', JSON.stringify(payload, null, 2));
    console.log('\nGoogle AI Studio request');
    const response = await ai.models.generateContent(payload);

    const inputTokens = response.usageMetadata.promptTokenCount ?? 0;
    const outputTokens = response.usageMetadata.candidatesTokenCount ?? 0;
    const totalTokens = response.usageMetadata.totalTokenCount ?? inputTokens + outputTokens;

    return {
        content: response.text,
        usage: {
            inputTokens,
            outputTokens,
            totalTokens
        }
    };
}

module.exports = { getGoogleResponse };