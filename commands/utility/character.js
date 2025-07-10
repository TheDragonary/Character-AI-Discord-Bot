const { SlashCommandBuilder } = require('discord.js');
const { baseURL, apiKey, model } = require('../../aiSettings.js');
const OpenAI = require('openai');
const openai = new OpenAI({ 
    baseURL: baseURL,
    apiKey: apiKey
});
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({});

async function extractImageData(imageUrl) {
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    const extractChunks = require('png-chunks-extract');
    const PNGtext = require('png-chunk-text');

    const response = await fetch(imageUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const chunks = extractChunks(buffer);

    let character = null;
    for (const chunk of chunks) {
        if (chunk.name === 'tEXt') {
            const textData = PNGtext.decode(chunk.data);
            if (textData.keyword && textData.keyword.toLowerCase().includes('chara')) {
                character = textData.text;
                break;
            }
        }
    }

    if (!character) {
        throw new Error('Image contains no character card metadata.');
    }

    const decodedString = Buffer.from(character, 'base64').toString('utf-8');
    const metadata = JSON.parse(decodedString);
    return metadata;
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('character')
        .setDescription('Import a character card for the AI to roleplay as')
        .addAttachmentOption(option =>
            option.setName('card')
                .setDescription('Character card png file')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('Text prompt')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const prompt = interaction.options.getString('prompt');
            const image = interaction.options.getAttachment('card');

            console.log(`\nModel used: ${model}\nUser: ${interaction.user.username}\nLocation: ${interaction.guild ? `${interaction.guild.name} - ${interaction.channel.name}` : `${interaction.user.username} - DM`}\nPrompt: ${prompt}`);

            const metadata = await extractImageData(image.url);

            const safeReplace = (str) => str
                .replace(/\{\{user\}\}/gi, username)
                .replace(/\{\{char\}\}/gi, charName);

            const username = interaction.user.displayName || interaction.user.username;
            const charName = metadata.data?.name || metadata.name ||  'the character';
            const description = safeReplace(metadata.data?.description || metadata.description || '');
            const personality = safeReplace(metadata.data?.personality || metadata.personality || '');
            const scenario = safeReplace(metadata.data?.scenario || metadata.scenario || '');
            const first_mes = safeReplace(metadata.data?.first_mes || metadata.first_mes || '');
            const mes_example = safeReplace(metadata.data?.mes_example || metadata.mes_example || '');

            const systemPrompt = `Write ${charName}'s next reply in a fictional chat between ${charName} and ${username}.`;

            console.log(`Character: ${charName}`);

            // const response = await openai.chat.completions.create({
            //     model,
            //     reasoning_effort: 'none',
            //     messages: [
            //         { role: 'system', content: systemPrompt },
            //         { role: 'system', content: description },
            //         { role: 'system', content: personality },
            //         { role: 'system', content: scenario },
            //         { role: 'system', content: '[Example Chat]' },
            //         { role: 'system', content: mes_example },
            //         { role: 'system', content: '[Start a new Chat]' },
            //         { role: 'assistant', content: first_mes },
            //         { role: 'user', content: prompt }
            //     ],
            //     temperature: 1.0
            // });

            const response = await ai.models.generateContent({
                model,
                contents: [
                    { role: 'model', parts: [ { text: first_mes } ] },
                    { role: 'user', parts: [ { text: prompt } ] }
                ],
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
                systemInstruction: {
                    parts: [ 
                        { text: systemPrompt },
                        { text: description },
                        { text: personality },
                        { text: scenario },
                        { text: '[Example Chat]' },
                        { text: mes_example },
                        { text: '[Start a new Chat]' }
                    ],
                }
            });

            const reply = response.text;
            console.log(`Response: ${reply}`);

            await interaction.editReply(reply);
        } catch (error) {
            console.error(error);
            await interaction.editReply(error.message || 'There was an error while executing this command!');
        }
    },
};