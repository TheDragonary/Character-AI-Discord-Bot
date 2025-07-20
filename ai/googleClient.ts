import { GoogleGenAI, HarmCategory, SafetySetting, Content, GenerateContentConfig } from '@google/genai';
import { apiKey } from './aiSettings';
const ai = new GoogleGenAI({apiKey: apiKey!});

let cachedGoogleModels: string[] = [];

async function fetchValidGoogleModels(): Promise<string[]> {
    if (cachedGoogleModels.length > 0) return cachedGoogleModels;

    const modelsPager = await ai.models.list();
    const models = [];
    for await (const model of modelsPager) {
        models.push(model);
    }

    cachedGoogleModels = models
        .filter((model: any) => model.supportedGenerativeModelType?.includes("text") || model.supportedActions?.includes("generateContent"))
        .map((model: any) => model.name);

    return cachedGoogleModels;
}

async function isValidGoogleModel(modelName: string): Promise<boolean> {
  const validModels = await fetchValidGoogleModels();
  return validModels.includes(modelName);
}

function convertHistory(rows: any[]): any[] {
    return rows.map(row => ({
        role: row.role === 'user' ? 'user' : 'model',
        parts: [{ text: row.content }]
    }));
}

export async function getGoogleResponse({ model, prompt, systemPrompt, description, personality, scenario, mes_example, historyRows }: { model: string, prompt: string, systemPrompt: string, description?: string, personality?: string, scenario?: string, mes_example?: string, historyRows: any[] }) {
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

    const payload: { model: string, contents: Content[], config: GenerateContentConfig } = {
        model,
        contents,
        config: {
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: 'BLOCK_NONE' },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: 'BLOCK_NONE' },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: 'BLOCK_NONE' },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: 'BLOCK_NONE' },
                { category: HarmCategory.HARM_CATEGORY_UNSPECIFIED, threshold: 'BLOCK_NONE' }
            ] as SafetySetting[],
            temperature: 1.0,
            systemInstruction: { role: 'system', parts: systemParts }
        }
    };

    console.log('Google AI Studio request:', JSON.stringify(payload, null, 2));
    const response = await ai.models.generateContent(payload);
    return response.text;
}
