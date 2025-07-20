import { Guild, TextBasedChannel, ThreadChannel } from 'discord.js';

export interface ThreadUtils {
    getDefaultThreadChannel(guildId: string): Promise<string | null>;
    getCharacterIdByName(userId: string, name: string): Promise<string>;
    createCharacterThread(threadId: string, guildId: string, userId: string, characterId: string): Promise<void>;
}

export interface CharacterHistoryUtils {
    getCharacterHistory(userId: string, name: string, limit?: number): Promise<Array<{ role: string; content: string }>>;
    addCharacterHistory(userId: string, name: string, role: string, content: string): Promise<void>;
}

export interface CharacterUtils {
    getFirstMessage(userId: string, username: string, name: string): Promise<string>;
}

export interface WebhookHandler {
    sendCharacterMessage(params: {
        userId: string;
        name: string;
        message: string;
        channel: TextBasedChannel;
    }): Promise<void>;
}

export interface Autocomplete {
    autocompleteCharacters(interaction: any, userId: string): Promise<void>;
}

export function cleanPrompt(prompt: string): string;