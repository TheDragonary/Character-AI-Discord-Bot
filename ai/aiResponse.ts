import { getGoogleResponse } from './googleClient';
import { getOpenAIResponse } from './openaiClient';

export async function getAIResponse(provider: string, ...args: any[]) {
    switch (provider) {
        case 'google':
            return await getGoogleResponse(args[0]);
        case 'openai':
            return await getOpenAIResponse(args[0]);
        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }
}
