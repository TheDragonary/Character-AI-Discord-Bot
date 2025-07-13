const { SlashCommandBuilder, EmbedBuilder, MessageFlags, AttachmentBuilder } = require('discord.js');
const { autocompleteHistory } = require('../../autocomplete');
const db = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('history')
        .setDescription('Manage chat history')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List message history count by character'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete history from a specific index')
                .addStringOption(option =>
                    option.setName('character')
                        .setDescription('Character name')
                        .setRequired(true)
                        .setAutocomplete(true))
                .addIntegerOption(option =>
                    option.setName('from')
                        .setDescription('Delete messages starting from this index (0-based)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('clear')
                .setDescription('Clear all chat history for a character')
                .addStringOption(option =>
                    option.setName('character')
                        .setDescription('Character name')
                        .setRequired(true)
                        .setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('export')
                .setDescription('Export full chat history to a file')
                .addStringOption(option =>
                    option.setName('character')
                        .setDescription('Character name')
                        .setRequired(true)
                        .setAutocomplete(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (subcommand === 'list') {
            const { rows } = await db.query(
                'SELECT character_name, COUNT(*) as count FROM character_history WHERE user_id = $1 GROUP BY character_name',
                [userId]
            );

            if (rows.length === 0) {
                return interaction.reply({ content: '❌ You have no history saved.', flags: MessageFlags.Ephemeral });
            }

            const embed = new EmbedBuilder()
                .setTitle('📚 Your Character History')
                .setDescription(rows.map(row => `**${row.character_name}**: ${row.count} messages`).join('\n'))
                .setColor('Blue');

            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

        } else if (subcommand === 'delete') {
            const character = interaction.options.getString('character');
            const from = interaction.options.getInteger('from');

            const { rows } = await db.query(
                'SELECT id FROM character_history WHERE (user_id = $1 OR user_id IS NULL) AND character_name = $2 ORDER BY id',
                [userId, character]
            );

            if (rows.length === 0) {
                return interaction.reply({ content: `❌ No history found for character "${character}".`, flags: MessageFlags.Ephemeral });
            }

            const idsToDelete = rows.slice(from).map(r => r.id);

            await db.query(
                'DELETE FROM character_history WHERE id = ANY($1)',
                [idsToDelete]
            );

            return interaction.reply({ content: `🗑️ Deleted ${idsToDelete.length} messages from index ${from} for character "${character}".`, flags: MessageFlags.Ephemeral });

        } else if (subcommand === 'clear') {
            const character = interaction.options.getString('character');

            await db.query(
                'DELETE FROM character_history WHERE (user_id = $1 OR user_id IS NULL) AND character_name = $2',
                [userId, character]
            );

            return interaction.reply({ content: `✅ Cleared all history for character "${character}".`, flags: MessageFlags.Ephemeral });

        } else if (subcommand === 'export') {
            const character = interaction.options.getString('character');

            const { rows } = await db.query(
                'SELECT timestamp, role, content FROM character_history WHERE (user_id = $1 OR user_id IS NULL) AND character_name = $2 ORDER BY timestamp',
                [userId, character]
            );

            if (rows.length === 0) {
                return interaction.reply({ content: `❌ No history found for "${character}".`, flags: MessageFlags.Ephemeral });
            }

            const exportText = rows.map(row => `[#${row.timestamp.toISOString()}] [${row.role.toUpperCase()}]: ${row.content}`).join('\n\n');
            const buffer = Buffer.from(exportText, 'utf-8');
            const file = new AttachmentBuilder(buffer, { name: `${character}_history.txt` });

            return interaction.reply({
                content: `📄 Exported chat history for "${character}".`,
                files: [file],
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async autocomplete(interaction) {
        const userId = interaction.user.id;
        await autocompleteHistory(interaction, userId);
    }
};