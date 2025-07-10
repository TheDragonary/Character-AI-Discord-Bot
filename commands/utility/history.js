const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('history')
        .setDescription('Manage chat history')
        .addSubcommand(subcommand =>
            subcommand
                .setName('clear')
                .setDescription('Clear chat history for a character')
                .addStringOption(option =>
                    option.setName('character')
                        .setDescription('Character name')
                        .setRequired(true)
                        .setAutocomplete(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'clear') {
            const charName = interaction.options.getString('character');
            const userId = interaction.user.id;

            await db.query(
                'DELETE FROM character_history WHERE user_id = $1 AND character_name = $2',
                [userId, charName]
            );

            await interaction.reply({ content: `✅ Cleared history for character "${charName}".`, flags: MessageFlags.Ephemeral });
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