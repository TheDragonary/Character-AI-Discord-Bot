declare module './utils/threadUtils' {
    export function deleteCharacterThread(threadId: string): Promise<void>;
    export function getThreadInfo(threadId: string): Promise<{
        guildId: string;
        userId: string;
        characterId: string;
    }>;
    export function getThreadCharacter(threadId: string): Promise<{
        id: string;
        name: string;
    }>;
}