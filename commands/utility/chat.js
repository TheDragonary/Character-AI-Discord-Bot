const { SlashCommandBuilder } = require('discord.js');
const { handleCharacterChat } = require('../../chatHandler');
const { sendCharacterMessage } = require('../../webhookHandler');
const { autocompleteCharacters } = require('../../autocomplete');
const { resolveCharacterName, getFirstMessage } = require('../../utils/characterUtils');
const { addCharacterHistory, checkHistoryExists } = require('../../utils/characterHistoryUtils');
const { splitMessage } = require('../../utils/formatUtils');
const db = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chat')
        .setDescription('Chat with a character')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('Text prompt')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('character')
                .setDescription('Character name')
                .setRequired(false)
                .setAutocomplete(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const userId = interaction.user.id;
        const username = interaction.user.displayName || interaction.user.username;
        const prompt = interaction.options.getString('prompt');
        const name = interaction.options.getString('character') || await resolveCharacterName(userId);

        try {
            if (!(await checkHistoryExists(userId, name))) {
                const reply = await getFirstMessage(userId, username, name);
                await addCharacterHistory(userId, name, 'character', reply);

                if (!interaction.channel) {
                    const chunks = splitMessage(reply);
                    for (let i = 0; i < chunks.length; i++) {
                        i === 0 ? await interaction.editReply(chunks[i]) : await interaction.followUp(chunks[i]);
                    }
                } else {
                    await sendCharacterMessage({
                        userId,
                        name,
                        message: reply,
                        channel: interaction.channel
                    });

                    await interaction.deleteReply();
                }
                return;
            }

            const reply = await handleCharacterChat({
                userId,
                username,
                prompt,
                name
            });

            if (!interaction.channel) {
                const chunks = splitMessage(reply);
                for (let i = 0; i < chunks.length; i++) {
                    i === 0 ? await interaction.editReply(chunks[i]) : await interaction.followUp(chunks[i]);
                }
            } else {
                await sendCharacterMessage({
                    userId,
                    name,
                    message: reply,
                    channel: interaction.channel
                });

                await interaction.editReply(`${interaction.user.displayName}: ${prompt}`);
            }
        } catch (error) {
            console.error(error);
            await interaction.editReply(error.message || 'There was an error while executing this command!');
        }
    },

    async autocomplete(interaction) {
        const userId = interaction.user.id;
        await autocompleteCharacters(interaction, userId);
    }
};