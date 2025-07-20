"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const chatHandler_1 = require("../chatHandler");
const webhookHandler_1 = require("../webhookHandler");
const threadUtils_1 = require("../utils/threadUtils");
const formatUtils_1 = require("../utils/formatUtils");
exports.default = {
    name: discord_js_1.Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || message.system || message.flags.has(discord_js_1.MessageFlags.HasSnapshot))
            return;
        const prompt = (0, formatUtils_1.cleanPrompt)(message.content);
        const userId = message.author.id;
        const username = message.author.displayName || message.author.username;
        try {
            const threadInfo = await (0, threadUtils_1.getThreadInfo)(message.channel.id);
            const character = await (0, threadUtils_1.getThreadCharacter)(message.channel.id);
            if (!threadInfo || !character || (threadInfo.user_id !== userId))
                return;
            if (message.channel.isTextBased() && (message.channel.type === discord_js_1.ChannelType.DM || message.channel.type === discord_js_1.ChannelType.GuildText || message.channel.type === discord_js_1.ChannelType.GuildNews || message.channel.isThread())) {
                await message.channel.sendTyping();
            }
            const response = await (0, chatHandler_1.handleCharacterChat)({
                userId,
                username,
                prompt,
                name: character.character_name
            });
            await (0, webhookHandler_1.sendCharacterMessage)({
                userId,
                name: character.character_name,
                message: response,
                channel: message.channel
            });
        }
        catch (error) {
            console.error(error);
            await message.reply(error.message || 'An error occurred while sending the message.');
        }
    },
};
