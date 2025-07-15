const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({});

let cachedGoogleModels = null;

async function fetchValidGoogleModels() {
    if (cachedGoogleModels) return cachedGoogleModels;

    const response = await ai.models.list();
    const models = response.pageInternal ?? [];

    cachedGoogleModels = models
        .filter(model => model.supportedActions.includes("generateContent"))
        .map(model => model.name);

    return cachedGoogleModels;
}

async function isValidGoogleModel(modelName) {
  const validModels = await fetchValidGoogleModels();
  return validModels.includes(modelName);
}

function convertHistory(rows) {
    return rows.map(row => ({
        role: row.role === 'user' ? 'user' : 'model',
        parts: [{ text: row.content }]
    }));
}

async function getGoogleResponse({ model, prompt, systemPrompt, description, personality, scenario, mes_example, historyRows }) {
    model = await isValidGoogleModel(model) ? model : "gemini-2.5-flash";
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

    console.log('Google AI Studio request:', JSON.stringify(payload, null, 2));
    const response = await ai.models.generateContent(payload);
    return response.text;
}

module.exports = {
    getGoogleResponse
};