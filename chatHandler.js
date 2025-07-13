const { baseURL, apiKey, model } = require('./aiSettings');
const db = require('./db');
const OpenAI = require('openai');
const openai = new OpenAI({ 
	baseURL: baseURL,
	apiKey: apiKey
});

async function handleCharacterChat({ userId, username, prompt, characterNameOverride = null }) {
    let charName = characterNameOverride;
    let characterData;

    if (charName) {
        const { rows } = await db.query(
            `SELECT * FROM characters 
            WHERE character_name = $1 AND (user_id = $2 OR user_id IS NULL)
            ORDER BY user_id NULLS LAST
            LIMIT 1`,
            [charName, userId]
        );

        if (rows.length === 0) {
            throw new Error(`Character "${charName}" not found.`);
        }
        characterData = rows[0];

        await db.query(`
            INSERT INTO user_settings (user_id, default_character)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET default_character = EXCLUDED.default_character`,
            [userId, charName]
        );
    } else {
        const { rows: settings } = await db.query(
            'SELECT default_character FROM user_settings WHERE user_id = $1',
            [userId]
        );

        if (settings.length === 0 || !settings[0].default_character) {
            throw new Error('No character specified and no default character set.');
        }

        charName = settings[0].default_character;

        const { rows } = await db.query(
            `SELECT * FROM characters 
            WHERE character_name = $1 AND (user_id = $2 OR user_id IS NULL)
            ORDER BY user_id NULLS LAST
            LIMIT 1`,
            [charName, userId]
        );


        if (rows.length === 0) {
            throw new Error(`Default character "${charName}" not found.`);
        }
        characterData = rows[0];
    }

    const safeReplace = (str) =>
        str.replace(/\{\{user\}\}/gi, username).replace(/\{\{char\}\}/gi, charName);

    const description = safeReplace(characterData.description || '');
    const personality = safeReplace(characterData.personality || '');
    const scenario = safeReplace(characterData.scenario || '');
    const first_mes = safeReplace(characterData.first_mes || '');
    const mes_example = safeReplace(characterData.mes_example || '');

    // const systemPrompt = `Write ${charName}'s next reply in a fictional chat between ${charName} and ${username}.`;

	const systemPrompt = `You are fully embodying the character ${charName}, and you're speaking directly to the user ${username} in a casual, immersive 
        conversation. This is not a narration, monologue, or storytelling — this is a direct dialogue, just like in a real chat. Stay completely in character 
        at all times. Speak naturally, react emotionally, and maintain continuity with prior messages. Keep replies concise, realistic, and engaging — like 
        a real person would in conversation. Do not describe actions unless the character themselves would say it aloud. Avoid exposition, scene-setting, or 
        story narration unless explicitly prompted. Only output dialogue — no internal thoughts or roleplay unless the user initiates it.`;

    const { rows: historyRows } = await db.query(
        `SELECT role, content FROM character_history 
         WHERE user_id = $1 AND character_name = $2 
         ORDER BY timestamp DESC LIMIT 10`,
        [userId, charName]
    );

    const chatHistory = historyRows.reverse().map(row => ({
        role: row.role === 'user' ? 'user' : 'assistant',
        content: row.content
    }));

    // const payload = {
    //     model,
    //     contents: [
    //         { role: 'model', parts: [{ text: first_mes }] },
    //         ...chatHistory,
    //         { role: 'user', parts: [{ text: prompt }] }
    //     ],
    //     safetySettings: [
    //         { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' },
    //         { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
    //         { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
    //         { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
    //         { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'OFF' }
    //     ],
    //     generationConfig: {
    //         temperature: 1.0
    //     },
    //     systemInstruction: {
    //         parts: [
    //             { text: systemPrompt },
    //             { text: description },
    //             { text: personality },
    //             { text: scenario },
    //             { text: '[Example Chat]' },
    //             { text: mes_example },
    //             { text: '[Start a new Chat]' }
    //         ]
    //     }
    // };

    // console.log('Google AI Studio request:', JSON.stringify(payload, null, 2));

    // const response = await ai.models.generateContent(payload);

    // const reply = response.text;

    const payload = {
        model,
        messages: [
            { role: "system", content: `${systemPrompt}\n\n${description}\n\n${personality}\n\n${scenario}\n\n[Example Chat]\n\n${mes_example}\n\n[Start a new Chat]` },
            { role: "assistant", content: first_mes },
            ...chatHistory,
            { role: "user", content: prompt }
        ],
        temperature: 0.7
    };

    console.log('OpenAI API request:', JSON.stringify(payload, null, 2));

    const response = await openai.chat.completions.create(payload);

    const reply = response.choices[0].message.content;

    console.log(reply);

    await db.query(
        `INSERT INTO character_history (user_id, character_name, role, content)
         VALUES ($1, $2, 'user', $3), ($1, $2, 'character', $4)`,
        [userId, charName, prompt, reply]
    );

    await db.query(
        `DELETE FROM character_history
         WHERE id IN (
             SELECT id FROM character_history
             WHERE user_id = $1 AND character_name = $2
             ORDER BY timestamp DESC
             OFFSET 20
         )`,
        [userId, charName]
    );

    return reply;
}

function splitMessage(text, limit = 2000) {
    const lines = text.split('\n');
    const chunks = [];
    let current = '';

    for (const line of lines) {
        if ((current + line).length > limit) {
            if (current) chunks.push(current);
            current = '';
        }
        current += line + '\n';
    }

    if (current) chunks.push(current);
    return chunks;
}

module.exports = {
    handleCharacterChat,
    splitMessage
};