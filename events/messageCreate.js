const { Events, MessageFlags } = require('discord.js');
const { handleCharacterChat } = require('../chatHandler');
const { sendCharacterMessage } = require('../webhookHandler');
const { getThreadCharacter } = require('../utils/threadUtils');

function cleanPrompt(content) {
    return content
        .replace(/<@!?(\d+)>/g, '')     // user mentions
        .replace(/<@&(\d+)>/g, '')      // role mentions
        .replace(/<#(\d+)>/g, '')       // channel mentions
        .trim();
}

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || message.system || message.flags.has(MessageFlags.HasSnapshot)) return;

        const prompt = cleanPrompt(message.content);
        const userId = message.author.id;
        const username = message.author.displayName || message.author.username;

        try {
            if (message.channel.isThread()) {
                const character = await getThreadCharacter(message.channel.id);
                if (!character) return;

                await message.channel.sendTyping();

                const response = await handleCharacterChat({
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
            }
        } catch (error) {
            console.error(error);
            await message.reply(error.message || 'An error occurred while sending the message.');
        }
    },
};