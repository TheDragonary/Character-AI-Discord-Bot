const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Manage your user settings')
        .addSubcommand(subcommand =>
            subcommand
                .setName('default')
                .setDescription('Set your default character')
                .addStringOption(option =>
                    option.setName('character')
                        .setDescription('Character name to set as default')
                        .setRequired(true)
                        .setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View your current settings')),

    async execute(interaction) {
        const userId = interaction.user.id;
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'default') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const charName = interaction.options.getString('character');

            try {
                const { rows: charRows } = await db.query(
                    'SELECT character_name FROM characters WHERE user_id = $1 AND character_name = $2',
                    [userId, charName]
                );

                if (charRows.length === 0) {
                    await interaction.editReply(`❌ Character **${charName}** not found in your list.`);
                    return;
                }

                await db.query(
                    `INSERT INTO user_settings (user_id, default_character)
                     VALUES ($1, $2)
                     ON CONFLICT (user_id) DO UPDATE SET default_character = EXCLUDED.default_character`,
                    [userId, charName]
                );

                await interaction.editReply(`✅ Default character set to **${charName}**.`);
            } catch (error) {
                console.error(error);
                await interaction.editReply('There was an error while setting your default character.');
            }
        } else if (subcommand === 'view') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            try {
                const { rows } = await db.query(
                    'SELECT default_character FROM user_settings WHERE user_id = $1',
                    [userId]
                );

                if (rows.length === 0 || !rows[0].default_character) {
                    await interaction.editReply("You don't have a default character set.");
                    return;
                }

                await interaction.editReply(`🛠️ Your default character is **${rows[0].default_character}**.`);
            } catch (error) {
                console.error(error);
                await interaction.editReply('There was an error while fetching your settings.');
            }
        }
    },

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused();
        const userId = interaction.user.id;

        try {
            const { rows } = await db.query(
                `SELECT character_name FROM characters 
                WHERE user_id = $1 OR user_id IS NULL`,
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