"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const threadUtils_1 = require("../../utils/threadUtils");
const characterHistoryUtils_1 = require("../../utils/characterHistoryUtils");
const characterUtils_1 = require("../../utils/characterUtils");
const webhookHandler_1 = require("../../webhookHandler");
const autocomplete_1 = require("../../autocomplete");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('chat')
        .setDescription('Start a thread to chat with a character')
        .addStringOption(option => option.setName('character')
        .setDescription('Character name')
        .setRequired(true)
        .setAutocomplete(true))
        .addStringOption(option => option.setName('visibility')
        .setDescription('Make the thread private or public')
        .setChoices({ name: 'Private', value: 'private' }, { name: 'Public', value: 'public' })),
    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.displayName || interaction.user.username;
        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.reply({ content: 'This command can only be used in a server', ephemeral: true });
            return;
        }
        const name = interaction.options.get('character')?.value;
        const visibility = interaction.options.get('visibility')?.value || 'private';
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        const defaultThreadChannelId = await (0, threadUtils_1.getDefaultThreadChannel)(guildId);
        let threadParent = interaction.channel;
        if (defaultThreadChannelId && interaction.guild) {
            const fetched = await interaction.guild.channels.fetch(defaultThreadChannelId).catch(() => null);
            if (fetched && (fetched.type === discord_js_1.ChannelType.GuildText || fetched.type === discord_js_1.ChannelType.GuildNews)) {
                threadParent = fetched;
            }
        }
        if (!threadParent || !threadParent.isTextBased()) {
            await interaction.editReply({ content: 'Cannot create thread in this channel type.' });
            return;
        }
        const textBasedThreadParent = threadParent;
        const thread = await textBasedThreadParent.threads.create({
            name: `${name} - ${username}`,
            autoArchiveDuration: 1440, // 24 hrs
            reason: `Started thread with ${name}`
        });
        if (visibility === 'private') {
            await thread.setLocked(true);
            await thread.setInvitable(false);
        }
        const characterId = await (0, threadUtils_1.getCharacterIdByName)(userId, name);
        await (0, threadUtils_1.createCharacterThread)(thread.id, guildId, userId, characterId);
        await thread.members.add(userId);
        const history = await (0, characterHistoryUtils_1.getCharacterHistory)(userId, name);
        if (history.length > 0) {
            for (const entry of history) {
                if (entry.role === 'user') {
                    await thread.send(`${username}: ${entry.content}`);
                }
                else if (entry.role === 'character') {
                    await (0, webhookHandler_1.sendCharacterMessage)({
                        userId,
                        name,
                        message: entry.content,
                        channel: thread
                    });
                }
            }
        }
        else {
            const firstMes = await (0, characterUtils_1.getFirstMessage)(userId, username, name);
            await thread.send(firstMes);
            await (0, characterHistoryUtils_1.addCharacterHistory)(userId, name, 'character', firstMes);
        }
        await interaction.editReply({ content: `Thread created: ${thread}` });
    },
    async autocomplete(interaction) {
        const userId = interaction.user.id;
        await (0, autocomplete_1.autocompleteCharacters)(interaction, userId);
    }
};
