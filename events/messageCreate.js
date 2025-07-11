const { Events, MessageFlags } = require('discord.js');
const { handleCharacterChat } = require('../chatHandler.js');
const { sendCharacterMessage, getStoredWebhookIds } = require('../webhookHandler.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || message.system || message.flags.has(MessageFlags.HasSnapshot)) return;

        try {
            const mention = message.mentions.has(message.client.user);

            let reply = false;
            if (message.reference) {
                try {
                    const repliedMessage = await message.fetchReference();
                    if (repliedMessage.author.id === message.client.user.id) {
                        reply = true;
                    } else {
                        const storedWebhookIds = await getStoredWebhookIds();
                        if (storedWebhookIds.includes(repliedMessage.webhookId)) {
                            reply = true;
                        }
                    }
                } catch (error) {
                    console.warn('Failed to fetch replied message:', error);
                }
            }

            if (!mention && !reply) return;
                
            await message.channel.sendTyping();

            const prompt = message.content.replace(/<@!?(\d+)>/, '').trim();

            try {
                const response = await handleCharacterChat({
                    userId: message.author.id,
                    username: message.author.displayName || message.author.username,
                    prompt
                });

                await sendCharacterMessage({
                    userId: message.author.id,
                    message: response,
                    interactionChannel: message.channel
                });
            } catch (error) {
                console.error(error);
                await message.reply(error.message || 'An error occurred while sending the message.');
            }
        } catch (error) {
            console.error(error);
            message.reply('An error occurred while sending the message.');
        }
    },
};