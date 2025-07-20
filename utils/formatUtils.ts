export function splitMessage(text: string, limit: number = 2000): string[] {
    const lines = text.split('\n');
    const chunks = [];
    let currentChunk = '';
    let currentLength = 0;

    for (const line of lines) {
        const lineWithNewline = `${line}\n`;

        if (lineWithNewline.length > limit) {
            if (currentChunk) {
                chunks.push(currentChunk);
                currentChunk = '';
                currentLength = 0;
            }

            for (let i = 0; i < lineWithNewline.length; i += limit) {
                chunks.push(lineWithNewline.slice(i, i + limit));
            }
            continue;
        }

        if (currentLength + lineWithNewline.length > limit) {
            chunks.push(currentChunk);
            currentChunk = '';
            currentLength = 0;
        }

        currentChunk += lineWithNewline;
        currentLength += lineWithNewline.length;
    }

    if (currentChunk) chunks.push(currentChunk);
    return chunks;
}

export function replaceCharacterPlaceholders(str: string = '', username: string, name: string): string {
    return str.replace(/\{\{user\}\}/gi, username).replace(/\{\{char\}\}/gi, name);
}

export function formatCharacterFields(data: any, fields: string[], username: string, name: string): Record<string, string> {
    return Object.fromEntries(
        fields.map(key => [key, replaceCharacterPlaceholders(data[key] || '', username, name)])
    );
}

export function normaliseMetadata(metadata: any): { name: string, description: string, personality: string, scenario: string, first_mes: string, mes_example: string, avatar_url: string | null } {
    const source = metadata?.data ?? metadata ?? {};
    const name = source.character_name ?? source.name ?? '';
    return {
        name,
        description: source.description ?? '',
        personality: source.personality ?? '',
        scenario: source.scenario ?? '',
        first_mes: source.first_mes ?? '',
        mes_example: source.mes_example ?? '',
        avatar_url: source.avatar_url ?? null
    };
}

export function formatCharacterList(rows: any[]): string {
    if (!rows.length) return 'None';
    return rows.map((r, i) => `${i + 1}. ${r.character_name}`).join('\n');
}

export function cleanPrompt(prompt: string): string {
    return prompt.trim();
}
