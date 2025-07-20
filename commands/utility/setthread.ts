import { SlashCommandBuilder, PermissionsBitField, MessageFlags, ChatInputCommandInteraction, ChannelType, TextChannel, NewsChannel } from 'discord.js';
import db from '../../db';

export default {
    data: new SlashCommandBuilder()
        .setName('set')
        .setDescription('Configure bot settings')
        .addSubcommand(subcommand =>
            subcommand
                .setName('thread')
                .setDescription('Configure thread settings [ADMIN ONLY]')
                .addChannelOption(option =>
            option.setName('channel')
                .setRequired(true)
                .setDescription('Channel for character threads')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildNews)))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),

    async execute(interaction: ChatInputCommandInteraction) {
        if (interaction.options.getSubcommand() !== 'thread') return;

        if (!interaction.member || !(interaction.member.permissions instanceof PermissionsBitField) || !interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({
                content: '❌ You need Manage Guild permission to use this.',
                flags: MessageFlags.Ephemeral
            });
        }

        const channel = interaction.options.getChannel('channel');
        if (!channel || !((channel as TextChannel | NewsChannel).isTextBased())) {
            return interaction.reply({
                content: '❌ That channel is not a valid text channel.',
                flags: MessageFlags.Ephemeral
            });
        }

        await db.query(
            `INSERT INTO guild_settings (guild_id, default_thread_channel_id)
            VALUES ($1, $2)
            ON CONFLICT (guild_id)
            DO UPDATE SET default_thread_channel_id = EXCLUDED.default_thread_channel_id`,
            [interaction.guildId, channel.id]
        );

        return interaction.reply({
            content: `✅ Set ${channel} as the default thread channel.`,
            flags: MessageFlags.Ephemeral
        });
    }
};