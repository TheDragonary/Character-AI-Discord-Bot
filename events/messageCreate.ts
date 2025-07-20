import { Events, MessageFlags, Message, ChannelType } from 'discord.js';
import { handleCharacterChat } from '../chatHandler';
import { sendCharacterMessage } from '../webhookHandler';
import { getThreadInfo, getThreadCharacter } from '../utils/threadUtils';
import { cleanPrompt } from '../utils/formatUtils';

export default {
    name: Events.MessageCreate,
    async execute(message: Message) {
        if (message.author.bot || message.system || message.flags.has(MessageFlags.HasSnapshot)) return;

        const prompt: string = cleanPrompt(message.content);
        const userId: string = message.author.id;
        const username: string = message.author.displayName || message.author.username;

        try {
            const threadInfo = await getThreadInfo(message.channel.id);
            const character = await getThreadCharacter(message.channel.id);
            if (!threadInfo || !character || (threadInfo.user_id !== userId)) return;

            if (message.channel.isTextBased() && (message.channel.type === ChannelType.DM || message.channel.type === ChannelType.GuildText || message.channel.type === ChannelType.GuildNews || message.channel.isThread())) {
                await message.channel.sendTyping();
            }

            const response: string = await handleCharacterChat({
                userId,
                username,
                prompt,
                name: character.character_name
            });

            await sendCharacterMessage({
                userId,
                name: character.character_name,
                message: response,
                channel: message.channel
            });
        } catch (error) {
            console.error(error);
            await message.reply((error as Error).message || 'An error occurred while sending the message.');
        }
    },
};