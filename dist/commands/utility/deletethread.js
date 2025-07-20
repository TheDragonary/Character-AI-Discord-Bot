"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const threadUtils_1 = require("../../utils/threadUtils");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('delete')
        .setDescription('End and delete this character chat thread')
        .addSubcommand(subcommand => subcommand
        .setName('thread')
        .setDescription('End and delete this character chat thread')),
    async execute(interaction) {
        try {
            const channel = interaction.channel;
            if (!channel || !channel.isThread()) {
                return interaction.reply({
                    content: 'This command can only be used inside a thread.',
                    flags: discord_js_1.MessageFlags.Ephemeral
                });
            }
            const threadOwner = await (0, threadUtils_1.getThreadInfo)(channel.id, 'user_id');
            if (threadOwner !== interaction.user.id) {
                return interaction.reply({
                    content: 'You are not the owner of this thread.',
                    flags: discord_js_1.MessageFlags.Ephemeral
                });
            }
            await (0, threadUtils_1.deleteCharacterThread)(channel.id);
            await interaction.reply({
                content: 'This thread will now be deleted.',
                flags: discord_js_1.MessageFlags.Ephemeral
            });
            setTimeout(() => {
                channel.delete();
            }, 1000);
        }
        catch (error) {
            console.error('Error deleting thread:', error);
            await interaction.reply(error.message);
        }
    }
};
