function splitMessage(text, limit = 2000) {
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

function replaceCharacterPlaceholders(str = '', username, charName) {
    return str.replace(/\{\{user\}\}/gi, username).replace(/\{\{char\}\}/gi, charName);
}

function formatCharacterFields(data, fields, username, charName) {
    return Object.fromEntries(
        fields.map(key => [key, replaceCharacterPlaceholders(data[key] || '', username, charName)])
    );
}

function normaliseMetadata(metadata) {
    const source = metadata?.data ?? metadata ?? {};
    return {
        name: source.name ?? '',
        description: source.description ?? '',
        personality: source.personality ?? '',
        scenario: source.scenario ?? '',
        first_mes: source.first_mes ?? '',
        mes_example: source.mes_example ?? '',
    };
}

function formatCharacterList(rows) {
    if (!rows.length) return 'None';
    return rows.map((r, i) => `${i + 1}. ${r.character_name}`).join('\n');
}

module.exports = {
    splitMessage,
    replaceCharacterPlaceholders,
    formatCharacterFields,
    normaliseMetadata,
    formatCharacterList
};