import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import { getThreadInfo, deleteCharacterThread } from '../../utils/threadUtils';

export default {
    data: new SlashCommandBuilder()
        .setName('delete')
        .setDescription('End and delete this character chat thread')
        .addSubcommand(subcommand =>
            subcommand
                .setName('thread')
                .setDescription('End and delete this character chat thread')),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const channel = interaction.channel;

            if (!channel || !channel.isThread()) {
                return interaction.reply({
                    content: 'This command can only be used inside a thread.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const threadOwner = await getThreadInfo(channel.id, 'user_id');

            if (threadOwner !== interaction.user.id) {
                return interaction.reply({
                    content: 'You are not the owner of this thread.',
                    flags: MessageFlags.Ephemeral
                });
            }

            await deleteCharacterThread(channel.id);

            await interaction.reply({
                content: 'This thread will now be deleted.',
                flags: MessageFlags.Ephemeral
            });

            setTimeout(() => {
                channel.delete();
            }, 1000);
        } catch (error) {
            console.error('Error deleting thread:', error);
            await interaction.reply((error as Error).message);
        }
    }
};