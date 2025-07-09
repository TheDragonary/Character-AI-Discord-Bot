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
        throw new Error('Image contains no character card metadata.');
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

            let systemPrompt = `You are now roleplaying as ${charName}. Here is your character card description: ${description}\n`;

            if (personality) {
                systemPrompt += `Here is your personality: ${personality}\n`;
            }

            systemPrompt += `Stay in character and respond as them in a roleplay conversation. Do not break character or refer to yourself as an AI. Always start your response with: \"${charName}: \"`;

            console.log(`Character: ${charName}`);

            const response = await openai.chat.completions.create({
                model,
                messages: [
                    { role: 'user', content: `${systemPrompt}\nPrompt: ${prompt}` }
                ],
                temperature: 1.0
            });

            console.log(`Response: ${response.choices[0].message.content}`);
            await interaction.editReply(response.choices[0].message.content);
        } catch (error) {
            console.error(error);
            await interaction.editReply(error.message || 'There was an error while executing this command!');
        }
    },
};