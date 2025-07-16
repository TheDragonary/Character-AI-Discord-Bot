const { SlashCommandBuilder } = require('discord.js');
const { sendCharacterMessage } = require('../../webhookHandler');
const { autocompleteCharacters } = require('../../autocomplete');
const { resolveCharacterName, getFirstMessage, getLastMessage } = require('../../utils/characterUtils');
const { splitMessage } = require('../../utils/formatUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resend')
        .setDescription('Resend last message from a character')
        .addStringOption(option =>
            option.setName('character')
                .setDescription('Character name')
                .setRequired(false)
                .setAutocomplete(true))
        .addBooleanOption(option =>
            option.setName('first')
                .setDescription('Resend first message')
                .setRequired(false)),

    async execute(interaction) {
        try {
            const firstFlag = interaction.options.getBoolean('first');
            const userId = interaction.user.id;
            const name = interaction.options.getString('character') || await resolveCharacterName(userId);

            let reply;
            if (firstFlag) {
                reply = await getFirstMessage(userId, interaction.user.username, name);
            } else {
                reply = await getLastMessage(userId, name);
            }

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
                await interaction.reply(firstFlag ? 'First message resent.' : 'Last message resent.');
            }
        } catch (error) {
            console.error(error);
            await interaction.reply(error.message);
        }
    },

    async autocomplete(interaction) {
        const userId = interaction.user.id;
        await autocompleteCharacters(interaction, userId);
    }
};