const { SlashCommandBuilder } = require('discord.js');
const { handleCharacterChat, splitMessage } = require('../../chatHandler.js');
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
        const charName = interaction.options.getString('character');
        const userId = interaction.user.id;
        const username = interaction.user.username;

        try {
            const reply = await handleCharacterChat({
                userId,
                username,
                prompt,
                characterNameOverride: charName
            });

            const chunks = splitMessage(reply);
            await interaction.editReply(chunks[0]);
            
            for (let i = 1; i < chunks.length; i++) {
                await interaction.followUp({ content: chunks[i] });
            }
        } catch (error) {
            console.error(error);
            await interaction.editReply(error.message || 'There was an error while executing this command!');
        }
    },

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused();
        const userId = interaction.user.id;

        try {
            const { rows } = await db.query(
                'SELECT character_name FROM characters WHERE user_id = $1',
                [userId]
            );

            const choices = rows.map(row => row.character_name);
            const filtered = choices
                .filter(name => name.toLowerCase().startsWith(focused.toLowerCase()))
                .slice(0, 25);

            await interaction.respond(
                filtered.map(choice => ({ name: choice, value: choice }))
            );
        } catch (err) {
            console.error('Autocomplete failed:', err);
            await interaction.respond([]);
        }
    }
};