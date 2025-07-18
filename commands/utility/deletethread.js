const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { deleteCharacterThread } = require('../../utils/threadUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete')
        .setDescription('End and delete this character chat thread')
        .addSubcommand(subcommand =>
            subcommand
                .setName('thread')
                .setDescription('End and delete this character chat thread')),

    async execute(interaction) {
        try {
            const channel = interaction.channel;

            if (!channel.isThread()) {
                return interaction.reply({
                    content: 'This command can only be used inside a thread.',
                    flags: MessageFlags.Ephemeral
                });
            }

            await deleteCharacterThread(channel.id);

            await interaction.reply({
                content: 'This thread will now be deleted.',
                flags: MessageFlags.Ephemeral
            });

            setTimeout(() => {
                channel.delete('User ended the character chat');
            }, 1000);
        } catch (error) {
            console.error('Error deleting thread:', error);
            await interaction.reply(error.message);
        }
    }
};