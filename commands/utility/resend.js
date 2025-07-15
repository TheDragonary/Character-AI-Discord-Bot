const { SlashCommandBuilder } = require('discord.js');
const { sendCharacterMessage } = require('../../webhookHandler');
const { autocompleteCharacters } = require('../../autocomplete');
const { getFirstMessage, splitMessage } = require('../../utils');
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
            let charName = interaction.options.getString('character');

            if (!charName) {
                const { rows } = await db.query(
                    'SELECT default_character FROM user_settings WHERE user_id = $1',
                    [userId]
                );
                if (!rows.length || !rows[0].default_character) {
                    throw new Error('No character specified and no default character set.');
                }
                charName = rows[0].default_character;
            }
        
            await db.query(`
                INSERT INTO user_settings (user_id, default_character)
                VALUES ($1, $2)
                ON CONFLICT (user_id) DO UPDATE SET default_character = EXCLUDED.default_character`,
                [userId, charName]
            );

            if (interaction.options.getBoolean('first')) {
                const reply = await getFirstMessage(userId, interaction.user.username, charName);
                if (!interaction.channel) {
                    await interaction.reply(reply);
                } else {
                    await sendCharacterMessage({
                        userId,
                        charName,
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
                    [userId, charName]
                );
            
                if (!rows.length) {
                    throw new Error(`No history found for character "${charName}".`);
                }

                if (!interaction.channel) {
                    const chunks = splitMessage(rows[0].content);
                    for (let i = 0; i < chunks.length; i++) {
                        if (i === 0) {
                            await interaction.reply(chunks[i]);
                        } else {
                            await interaction.followUp(chunks[i]);
                        }
                    }
                } else {
                    await sendCharacterMessage({
                        userId,
                        charName,
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