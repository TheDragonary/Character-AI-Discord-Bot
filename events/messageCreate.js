const { Events, MessageFlags } = require('discord.js');
const { handleCharacterChat } = require('../chatHandler');
const { sendCharacterMessage, getStoredWebhookIds } = require('../webhookHandler');
const { getDefaultCharacter, getFirstMessage } = require('../utils/characterUtils');
const db = require('../db');

function cleanPrompt(content) {
    return content
        .replace(/<@!?(\d+)>/g, '')     // user mentions
        .replace(/<@&(\d+)>/g, '')      // role mentions
        .replace(/<#(\d+)>/g, '')       // channel mentions
        .trim();
}

async function shouldRespond(message, clientId) {
    if (message.mentions.has(clientId)) return true;

    if (message.reference) {
        try {
            const repliedMessage = await message.fetchReference();
            if (repliedMessage.author.id === clientId) return true;

            const storedWebhookIds = await getStoredWebhookIds();
            return storedWebhookIds.includes(repliedMessage.webhookId);
        } catch (error) {
            console.warn('Failed to fetch replied message:', error);
        }
    }

    return false;
}

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || message.system || message.flags.has(MessageFlags.HasSnapshot)) return;

        const shouldReply = await shouldRespond(message, message.client.user.id);
        if (!shouldReply) return;

        const prompt = cleanPrompt(message.content);
        const userId = message.author.id;
        const username = message.author.displayName || message.author.username;

        try {
            const charName = await getDefaultCharacter(userId);

            const { rows: historyRows } = await db.query(
                'SELECT 1 FROM character_history WHERE user_id = $1 AND character_name = $2 LIMIT 1',
                [userId, charName]
            );

            if (historyRows.length === 0) {
                const reply = await getFirstMessage(userId, username, charName);
                
                await db.query(
                    `INSERT INTO character_history (user_id, character_name, role, content)
                        VALUES ($1, $2, 'character', $3)`,
                    [userId, charName, reply]
                );

                await sendCharacterMessage({
                    userId,
                    characterNameOverride: charName,
                    message: reply,
                    channel: message.channel
                });

                return;
            }
            
            await message.channel.sendTyping();

            const response = await handleCharacterChat({
                userId,
                username,
                prompt
            });

            await sendCharacterMessage({
                userId,
                message: response,
                channel: message.channel
            });
        } catch (error) {
            console.error(error);
            await message.reply(error.message || 'An error occurred while sending the message.');
        }
    },
};