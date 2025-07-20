import {
    SlashCommandBuilder,
    ChannelType,
    MessageFlags,
    ChatInputCommandInteraction,
    AutocompleteInteraction,
    TextChannel,
    NewsChannel
} from 'discord.js';

import {
    getDefaultThreadChannel,
    getCharacterIdByName,
    createCharacterThread
} from '../../utils/threadUtils';
import {
    getCharacterHistory,
    addCharacterHistory
} from '../../utils/characterHistoryUtils';
import {
    getFirstMessage
} from '../../utils/characterUtils';
import {
    sendCharacterMessage
} from '../../webhookHandler';
import {
    autocompleteCharacters
} from '../../autocomplete';

export default {
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

    async execute(interaction: ChatInputCommandInteraction) {
        const userId = interaction.user.id;
        const username = interaction.user.displayName || interaction.user.username;
        const guildId = interaction.guildId;

        if (!guildId) {
            await interaction.reply({ content: 'This command can only be used in a server', ephemeral: true });
            return;
        }

        const name = interaction.options.get('character')?.value as string;
        const visibility = interaction.options.get('visibility')?.value as string || 'private';

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const defaultThreadChannelId = await getDefaultThreadChannel(guildId);
        let threadParent: TextChannel | NewsChannel | null = interaction.channel as TextChannel | NewsChannel | null;

        if (defaultThreadChannelId && interaction.guild) {
            const fetched = await interaction.guild.channels.fetch(defaultThreadChannelId).catch(() => null);
            if (fetched && (fetched.type === ChannelType.GuildText || fetched.type === ChannelType.GuildNews)) {
                threadParent = fetched as TextChannel | NewsChannel;
            }
        }

        if (!threadParent || !threadParent.isTextBased()) {
            await interaction.editReply({ content: 'Cannot create thread in this channel type.' });
            return;
        }

        const textBasedThreadParent = threadParent as TextChannel | NewsChannel;
        const thread = await textBasedThreadParent.threads.create({
            name: `${name} - ${username}`,
            autoArchiveDuration: 1440, // 24 hrs
            reason: `Started thread with ${name}`
        });

        if (visibility === 'private') {
            await thread.setLocked(true);
            await thread.setInvitable(false);
        }

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

    async autocomplete(interaction: AutocompleteInteraction) {
        const userId = interaction.user.id;
        await autocompleteCharacters(interaction, userId);
    }
};