const { SlashCommandBuilder } = require('discord.js');
const { handleCharacterChat } = require('../../chatHandler');
const { sendCharacterMessage } = require('../../webhookHandler');
const { autocompleteCharacters } = require('../../autocomplete');
const { getFirstMessage, splitMessage } = require('../../utils');
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

        const prompt = interaction.options.getString('prompt');
        let charName = interaction.options.getString('character');
        const userId = interaction.user.id;
        const username = interaction.user.displayName || interaction.user.username;

        if (!charName) {
            const { rows } = await db.query(
                'SELECT default_character FROM user_settings WHERE user_id = $1',
                [userId]
            );

            if (!rows.length || !rows[0].default_character) {
                return await interaction.editReply('No character specified and no default character set.');
            }

            charName = rows[0].default_character;
        }

        try {
            const { rows: historyRows } = await db.query(
                'SELECT 1 FROM character_history WHERE user_id = $1 AND character_name = $2 LIMIT 1',
                [userId, charName]
            );

            if (historyRows.length === 0) {
                const reply = await getFirstMessage(userId, username, charName);
                
                await db.query(
                    `INSERT INTO character_history (user_id, character_name, role, content)
                        VALUES ($1, $2, 'character', $3)`,
                    [userId, charName, reply]
                );

                if (!interaction.channel) {
                    const chunks = splitMessage(reply);
                    for (let i = 0; i < chunks.length; i++) {
                        if (i === 0) {
                            await interaction.editReply(chunks[i]);
                        } else {
                            await interaction.followUp(chunks[i]);
                        }
                    }
                } else {
                    await sendCharacterMessage({
                        userId,
                        charName,
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
                charName
            });

            if (!interaction.channel) {
                const chunks = splitMessage(reply);
                for (let i = 0; i < chunks.length; i++) {
                    if (i === 0) {
                        await interaction.editReply(chunks[i]);
                    } else {
                        await interaction.followUp(chunks[i]);
                    }
                }
            } else {
                await sendCharacterMessage({
                    userId,
                    charName,
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