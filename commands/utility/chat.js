const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const { getDefaultThreadChannel, getCharacterIdByName, createCharacterThread } = require('../../utils/threadUtils');
const { getCharacterHistory,addCharacterHistory } = require('../../utils/characterHistoryUtils');
const { getFirstMessage } = require('../../utils/characterUtils');
const { sendCharacterMessage } = require('../../webhookHandler');
const { autocompleteCharacters } = require('../../autocomplete');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chat')
        .setDescription('Start a thread to chat with a character')
        .addStringOption(option =>
            option.setName('character')
                .setDescription('Character name')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('visibility')
                .setDescription('Make the thread private or public')
                .setChoices(
                    { name: 'Private', value: 'private' },
                    { name: 'Public', value: 'public' }
                )),

    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.displayName || interaction.user.username;
        const guildId = interaction.guildId;

        const name = interaction.options.getString('character');
        const visibility = interaction.options.getString('visibility') || 'private';

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const defaultThreadChannelId = await getDefaultThreadChannel(guildId);
        let threadParent = interaction.channel;

        if (defaultThreadChannelId && interaction.guild) {
            const fetched = await interaction.guild.channels.fetch(defaultThreadChannelId).catch(() => null);
            if (fetched && fetched.isTextBased()) {
                threadParent = fetched;
            }
        }

        const thread = await threadParent.threads.create({
            name: `${name} - ${username}`,
            autoArchiveDuration: 1440, // 24 hrs
            type: visibility === 'private' ? ChannelType.PrivateThread : ChannelType.PublicThread,
            reason: `Started thread with ${name}`
        });

        const characterId = await getCharacterIdByName(userId, name);
        await createCharacterThread(thread.id, guildId, userId, characterId);
        await thread.members.add(userId);

        const history = await getCharacterHistory(userId, name);

        if (history.length > 0) {
            for (const entry of history) {
                if (entry.role === 'user') {
                    await thread.send(`${username}: ${entry.content}`);
                } else if (entry.role === 'character') {
                    await sendCharacterMessage({
                        userId,
                        name,
                        message: entry.content,
                        channel: thread
                    });
                }
            }
        } else {
            const firstMes = await getFirstMessage(userId, username, name);
            await thread.send(firstMes);
            await addCharacterHistory(userId, name, 'character', firstMes);
        }

        await interaction.editReply({ content: `Thread created: ${thread}` });
    },

    async autocomplete(interaction) {
        const userId = interaction.user.id;
        await autocompleteCharacters(interaction, userId);
    }
};