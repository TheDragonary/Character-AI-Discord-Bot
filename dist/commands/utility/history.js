"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const autocomplete_1 = require("../../autocomplete");
const db_1 = __importDefault(require("../../db"));
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('history')
        .setDescription('Manage chat history')
        .addSubcommand(subcommand => subcommand
        .setName('list')
        .setDescription('List message history count by character'))
        .addSubcommand(subcommand => subcommand
        .setName('delete')
        .setDescription('Delete the last 2 messages for a character')
        .addStringOption(option => option.setName('character')
        .setDescription('Character name')
        .setRequired(true)
        .setAutocomplete(true))
        .addIntegerOption(option => option.setName('amount')
        .setDescription('Number of messages to delete')
        .setRequired(false)))
        .addSubcommand(subcommand => subcommand
        .setName('clear')
        .setDescription('Clear all chat history for a character')
        .addStringOption(option => option.setName('character')
        .setDescription('Character name')
        .setRequired(true)
        .setAutocomplete(true)))
        .addSubcommand(subcommand => subcommand
        .setName('export')
        .setDescription('Export full chat history to a file')
        .addStringOption(option => option.setName('character')
        .setDescription('Character name')
        .setRequired(true)
        .setAutocomplete(true))),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        if (subcommand === 'list') {
            const { rows } = await db_1.default.query('SELECT character_name, COUNT(*) as count FROM character_history WHERE user_id = $1 GROUP BY character_name', [userId]);
            if (rows.length === 0) {
                return interaction.reply({ content: '❌ You have no history saved.', flags: discord_js_1.MessageFlags.Ephemeral });
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('📚 Your Character History')
                .setDescription(rows.map(row => `**${row.character_name}**: ${row.count} messages`).join('\n'))
                .setColor('Blue');
            return interaction.reply({ embeds: [embed], flags: discord_js_1.MessageFlags.Ephemeral });
        }
        else if (subcommand === 'delete') {
            const character = interaction.options.getString('character');
            const amount = interaction.options.getInteger('amount');
            const { rows } = await db_1.default.query('SELECT id FROM character_history WHERE user_id = $1 AND character_name = $2 ORDER BY id DESC', [userId, character || '']);
            if (rows.length === 0) {
                return interaction.reply({ content: `❌ No history found for character "${character}".`, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            const idsToDelete = rows.slice(0, amount ?? 2).map(r => r.id);
            await db_1.default.query('DELETE FROM character_history WHERE id = ANY($1)', [idsToDelete]);
            return interaction.reply({
                content: `🗑️ Deleted the last ${idsToDelete.length} messages for character "${character}".`,
                flags: discord_js_1.MessageFlags.Ephemeral
            });
        }
        else if (subcommand === 'clear') {
            const character = interaction.options.getString('character');
            await db_1.default.query('DELETE FROM character_history WHERE (user_id = $1 OR user_id IS NULL) AND character_name = $2', [userId, character || '']);
            return interaction.reply({ content: `✅ Cleared all history for character "${character}".`, flags: discord_js_1.MessageFlags.Ephemeral });
        }
        else if (subcommand === 'export') {
            const character = interaction.options.getString('character');
            const { rows } = await db_1.default.query('SELECT timestamp, role, content FROM character_history WHERE (user_id = $1 OR user_id IS NULL) AND character_name = $2 ORDER BY timestamp', [userId, character || '']);
            if (rows.length === 0) {
                return interaction.reply({ content: `❌ No history found for "${character}".`, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            const exportText = rows.map(row => `[#${row.timestamp.toISOString()}] [${row.role.toUpperCase()}]: ${row.content}`).join('\n\n');
            const buffer = Buffer.from(exportText, 'utf-8');
            const file = new discord_js_1.AttachmentBuilder(buffer, { name: `${character}_history.txt` });
            return interaction.reply({
                content: `📄 Exported chat history for "${character}".`,
                files: [file],
                flags: discord_js_1.MessageFlags.Ephemeral
            });
        }
    },
    async autocomplete(interaction) {
        const userId = interaction.user.id;
        await (0, autocomplete_1.autocompleteHistory)(interaction, userId);
    }
};
