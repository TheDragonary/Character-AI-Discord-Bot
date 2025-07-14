const { baseURL, apiKey } = require('./aiSettings');
const OpenAI = require('openai');
const openai = new OpenAI({ 
    baseURL: baseURL,
    apiKey: apiKey
});
const { GoogleGenAI } = require("@google/genai");
const googleAI = new GoogleGenAI({});

function convertHistory(provider, rows) {
    if (provider === 'google') {
        return rows.reverse().map(row => ({
            role: row.role === 'user' ? 'user' : 'model',
            parts: [{ text: row.content }]
        }));
    } else {
        return rows.reverse().map(row => ({
            role: row.role === 'user' ? 'user' : 'assistant',
            content: row.content
        }));
    }
}

async function getAIResponse(provider, model, prompt, systemPrompt, description, personality, scenario, first_mes, mes_example, historyRows) {
    const chatHistory = convertHistory(provider, historyRows);
    if (provider === 'google') {
        const payload = {
            model: 'gemini-2.5-flash',
            contents: [
                { role: 'model', parts: [{ text: first_mes }] },
                ...chatHistory,
                { role: 'user', parts: [{ text: prompt }] }
            ],
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
            systemInstruction: {
                parts: [
                    { text: systemPrompt },
                    ...(description ? [{ text: description }] : []),
                    ...(personality ? [{ text: personality }] : []),
                    ...(scenario ? [{ text: scenario }] : []),
                    ...(mes_example ? [
                        { text: '[Example Chat]' },
                        { text: mes_example }
                    ] : []),
                    { text: '[Start a new Chat]' }
                ]
            }
        };

        console.log('Google AI Studio request:', JSON.stringify(payload, null, 2));
        const response = await googleAI.models.generateContent(payload);
        return response.text;
    } else {
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
                { role: "assistant", content: first_mes },
                ...chatHistory,
                { role: "user", content: prompt }
            ],
            temperature: 0.7
        };

        console.log('OpenAI API request:', JSON.stringify(payload, null, 2));
        const response = await openai.chat.completions.create(payload);
        return response.choices[0].message.content;
    }
}

module.exports = { getAIResponse };