"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const db_1 = __importDefault(require("../../db"));
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('set')
        .setDescription('Configure bot settings')
        .addSubcommand(subcommand => subcommand
        .setName('thread')
        .setDescription('Configure thread settings [ADMIN ONLY]')
        .addChannelOption(option => option.setName('channel')
        .setRequired(true)
        .setDescription('Channel for character threads')
        .addChannelTypes(discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildNews)))
        .setDefaultMemberPermissions(discord_js_1.PermissionsBitField.Flags.ManageGuild),
    async execute(interaction) {
        if (interaction.options.getSubcommand() !== 'thread')
            return;
        if (!interaction.member || !(interaction.member.permissions instanceof discord_js_1.PermissionsBitField) || !interaction.member.permissions.has(discord_js_1.PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({
                content: '❌ You need Manage Guild permission to use this.',
                flags: discord_js_1.MessageFlags.Ephemeral
            });
        }
        const channel = interaction.options.getChannel('channel');
        if (!channel || !(channel.isTextBased())) {
            return interaction.reply({
                content: '❌ That channel is not a valid text channel.',
                flags: discord_js_1.MessageFlags.Ephemeral
            });
        }
        await db_1.default.query(`INSERT INTO guild_settings (guild_id, default_thread_channel_id)
            VALUES ($1, $2)
            ON CONFLICT (guild_id)
            DO UPDATE SET default_thread_channel_id = EXCLUDED.default_thread_channel_id`, [interaction.guildId, channel.id]);
        return interaction.reply({
            content: `✅ Set ${channel} as the default thread channel.`,
            flags: discord_js_1.MessageFlags.Ephemeral
        });
    }
};
