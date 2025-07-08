const { SlashCommandBuilder } = require('discord.js');
const { baseURL, apiKey, model } = require('../../aiSettings.js');
const OpenAI = require('openai');
const openai = new OpenAI({ 
    baseURL: baseURL,
    apiKey: apiKey
});

async function extractImageData(imageUrl) {
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    const extractChunks = require('png-chunks-extract');
    const PNGtext = require('png-chunk-text');
    const atob = require('atob');

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
        throw new Error('Character card metadata not found in PNG.');
    }

    const decodedString = atob(character);
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

        const prompt = interaction.options.getString('prompt');
        const image = interaction.options.getAttachment('card');
        const metadata = await extractImageData(image.url);
        const safeReplace = (str) => str.replace(/\[user\]|\{user\}|\{\{user\}\}/gi, username);

        const username = interaction.user.displayName || interaction.user.username;
        const charName = metadata.data?.name || metadata.name ||  'the character';
        const description = safeReplace(metadata.data?.description || metadata.description || '');
        const personality = safeReplace(metadata.data?.personality || metadata.personality || '');

        const systemPrompt = `You are now roleplaying as ${charName}. Here is your character card description: ${description}\nHere is your personality: ${personality}\nStay in character and respond as them in a roleplay conversation. Do not break character or refer to yourself as an AI. Always start your response with: \"${charName}: \"`;

        console.log(`Model used: ${model}\nUser: ${interaction.user.username}\nLocation: ${interaction.guild ? `${interaction.guild.name} - ${interaction.channel.name}` : `${interaction.user.username} - DM`}\nPrompt: ${prompt}`);

        const aiResponse = await openai.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            temperature: 0.9
        });

        const response = aiResponse.choices[0]?.message?.content;
        console.log(`Response: ${response}`);

        await interaction.editReply(response);
    },
};