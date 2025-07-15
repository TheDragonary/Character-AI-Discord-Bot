const { Events, MessageFlags } = require('discord.js');
const { handleCharacterChat } = require('../chatHandler');
const { sendCharacterMessage, getStoredWebhookIds } = require('../webhookHandler');
const { getFirstMessage } = require('../utils');
const db = require('../db');

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

            function cleanPrompt(content) {
                return content
                    .replace(/<@!?(\d+)>/g, '')     // user mentions
                    .replace(/<@&(\d+)>/g, '')      // role mentions
                    .replace(/<#(\d+)>/g, '')       // channel mentions
                    .trim();
            }

            const prompt = cleanPrompt(message.content);

            try {
                const { rows } = await db.query(
                    'SELECT default_character FROM user_settings WHERE user_id = $1',
                    [message.author.id]
                );

                if (!rows.length || !rows[0].default_character) {
                    return await interaction.editReply('No character specified and no default character set.');
                }

                const charName = rows[0].default_character;

                const { rows: historyRows } = await db.query(
                    'SELECT 1 FROM character_history WHERE user_id = $1 AND character_name = $2 LIMIT 1',
                    [message.author.id, charName]
                );
    
                if (historyRows.length === 0) {
                    const reply = await getFirstMessage(message.author.id, message.author.displayName || message.author.username, charName);
                    
                    await db.query(
                        `INSERT INTO character_history (user_id, character_name, role, content)
                            VALUES ($1, $2, 'character', $3)`,
                        [message.author.id, charName, reply]
                    );

                    await sendCharacterMessage({
                        userId: message.author.id,
                        characterNameOverride: charName,
                        message: reply,
                        channel: message.channel
                    });
                    return;
                }
                
                await message.channel.sendTyping();

                const response = await handleCharacterChat({
                    userId: message.author.id,
                    username: message.author.displayName || message.author.username,
                    prompt
                });

                await sendCharacterMessage({
                    userId: message.author.id,
                    message: response,
                    channel: message.channel
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