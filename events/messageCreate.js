const { Events, MessageFlags } = require('discord.js');
const { handleCharacterChat } = require('../chatHandler.js');
const { sendCharacterMessage } = require('../webhookHandler.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || message.system || message.flags.has(MessageFlags.HasSnapshot)) return;

        try {
            const mention = message.mentions.has(message.client.user);
            const reply = message.reference && (await message.fetchReference())?.author?.id === message.client.user.id;

            if (!mention && !reply) return;
                
            await message.channel.sendTyping();

            const prompt = message.content.replace(/<@!?(\d+)>/, '').trim();

            try {
                const reply = await handleCharacterChat({
                    userId: message.author.id,
                    username: message.author.displayName || message.author.username,
                    prompt
                });

                await sendCharacterMessage({
                    userId: message.author.id,
                    message: reply,
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