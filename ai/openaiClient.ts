import { baseURL, apiKey } from './aiSettings';
import OpenAI from 'openai';
const openai = new OpenAI({ baseURL, apiKey });

let cachedOpenAIModels: string[] = [];

export async function fetchValidOpenAIModels() {
    if (cachedOpenAIModels.length > 0) return cachedOpenAIModels;

    try {
        const response = await openai.models.list();

        const models = response.data.flatMap((model: any) => {
            const aliases = model.aliases || [];
            return [model.id, ...aliases];
        });

        cachedOpenAIModels = models;
        return cachedOpenAIModels;
    } catch (error) {
        console.error("Error fetching OpenAI models:", error);
        return [];
    }
}

export async function isValidOpenAIModel(modelName: string): Promise<boolean> {
    const validModels = await fetchValidOpenAIModels();
    return validModels.includes(modelName);
}

export function convertHistory(rows: any[]): any[] {
    return rows.map(row => ({
        role: row.role === 'user' ? 'user' : 'assistant',
        content: row.content
    }));
}

export async function getOpenAIResponse({ model, prompt, systemPrompt, description, personality, scenario, mes_example, historyRows }: { model: string, prompt: string, systemPrompt: string, description?: string, personality?: string, scenario?: string, mes_example?: string, historyRows: any[] }) {
    model = await isValidOpenAIModel(model) ? model : 'invalid';
    if (model === 'invalid') throw new Error('Selected model is invalid.');

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

    console.log('OpenAI API request:', JSON.stringify(payload, null, 2));
    const response = await openai.chat.completions.create(payload);
    return response.choices[0].message.content;
}
