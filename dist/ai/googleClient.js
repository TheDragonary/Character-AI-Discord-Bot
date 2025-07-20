"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGoogleResponse = getGoogleResponse;
const genai_1 = require("@google/genai");
const aiSettings_1 = require("./aiSettings");
const ai = new genai_1.GoogleGenAI({ apiKey: aiSettings_1.apiKey });
let cachedGoogleModels = [];
async function fetchValidGoogleModels() {
    if (cachedGoogleModels.length > 0)
        return cachedGoogleModels;
    const modelsPager = await ai.models.list();
    const models = [];
    for await (const model of modelsPager) {
        models.push(model);
    }
    cachedGoogleModels = models
        .filter((model) => model.supportedGenerativeModelType?.includes("text") || model.supportedActions?.includes("generateContent"))
        .map((model) => model.name);
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
    if (!(await isValidGoogleModel(model))) {
        throw new Error(`Invalid Google model: ${model}`);
    }
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
        config: {
            safetySettings: [
                { category: genai_1.HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: 'BLOCK_NONE' },
                { category: genai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: 'BLOCK_NONE' },
                { category: genai_1.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: 'BLOCK_NONE' },
                { category: genai_1.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: 'BLOCK_NONE' },
                { category: genai_1.HarmCategory.HARM_CATEGORY_UNSPECIFIED, threshold: 'BLOCK_NONE' }
            ],
            temperature: 1.0,
            systemInstruction: { role: 'system', parts: systemParts }
        }
    };
    console.log('Google AI Studio request:', JSON.stringify(payload, null, 2));
    const response = await ai.models.generateContent(payload);
    return response.text;
}
