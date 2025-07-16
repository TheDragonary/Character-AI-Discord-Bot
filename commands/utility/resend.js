const { SlashCommandBuilder } = require('discord.js');
const { sendCharacterMessage } = require('../../webhookHandler');
const { autocompleteCharacters } = require('../../autocomplete');
const { setDefaultCharacter, resolveCharacterName, getFirstMessage } = require('../../utils/characterUtils');
const { splitMessage } = require('../../utils/formatUtils');
const db = require('../../db');

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
            const userId = interaction.user.id;
            const name = interaction.options.getString('character') || await resolveCharacterName(userId);
            
            await setDefaultCharacter(userId, name);

            if (interaction.options.getBoolean('first')) {
                const reply = await getFirstMessage(userId, interaction.user.username, name);
                if (!interaction.channel) {
                    await interaction.reply(reply);
                } else {
                    await sendCharacterMessage({
                        userId,
                        name,
                        message: reply,
                        channel: interaction.channel
                    });
                    await interaction.reply('First message resent.');
                }
            } else {
                const { rows } = await db.query(
                    `SELECT * FROM character_history
                    WHERE user_id = $1 AND character_name = $2 AND role = 'character'
                    ORDER BY timestamp DESC
                    LIMIT 1`,
                    [userId, name]
                );
            
                if (!rows.length) {
                    throw new Error(`No history found for character "${name}".`);
                }

                if (!interaction.channel) {
                    const chunks = splitMessage(rows[0].content);
                    for (let i = 0; i < chunks.length; i++) {
                        i === 0 ? await interaction.editReply(chunks[i]) : await interaction.followUp(chunks[i]);
                    }
                } else {
                    await sendCharacterMessage({
                        userId,
                        name,
                        message: rows[0].content,
                        channel: interaction.channel
                    });
                    await interaction.reply('Last message resent.');
                }
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