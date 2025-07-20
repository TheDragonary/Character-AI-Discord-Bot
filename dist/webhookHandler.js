"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWebhookInfo = getWebhookInfo;
exports.createWebhook = createWebhook;
exports.getGuildWebhook = getGuildWebhook;
exports.getCharacterWithWebhook = getCharacterWithWebhook;
exports.sendCharacterMessage = sendCharacterMessage;
exports.getStoredWebhookIds = getStoredWebhookIds;
const discord_js_1 = require("discord.js");
const characterUtils_1 = require("./utils/characterUtils");
const formatUtils_1 = require("./utils/formatUtils");
const db_1 = __importDefault(require("./db"));
async function getWebhookInfo(guildId) {
    const { rows } = await db_1.default.query('SELECT channel_id, webhook_id, webhook_token FROM guild_webhooks WHERE guild_id = $1', [guildId]);
    return rows.length > 0 ? rows[0] : null;
}
async function createWebhook(guildId, channel) {
    if (!channel)
        throw new Error('No channel provided for webhook creation.');
    const existing = await getWebhookInfo(guildId);
    if (existing) {
        try {
            const oldWebhook = new discord_js_1.WebhookClient({ id: existing.webhook_id, token: existing.webhook_token });
            await oldWebhook.delete();
        }
        catch (error) {
            console.warn('Failed to delete old webhook from Discord:', error.message);
        }
        await db_1.default.query('DELETE FROM guild_webhooks WHERE guild_id = $1', [guildId]);
    }
    const webhook = await channel.createWebhook({
        name: 'Character Bot Webhook',
        avatar: null
    });
    await db_1.default.query(`INSERT INTO guild_webhooks (guild_id, channel_id, webhook_id, webhook_token)
         VALUES ($1, $2, $3, $4)`, [guildId, channel.id, webhook.id, webhook.token]);
    return webhook;
}
async function getGuildWebhook(guildId, channel) {
    const webhookInfo = await getWebhookInfo(guildId);
    if (webhookInfo && webhookInfo.channel_id === channel.id) {
        return new discord_js_1.WebhookClient({ id: webhookInfo.webhook_id, token: webhookInfo.webhook_token });
    }
    const baseChannel = channel.isThread() ? channel.parent : channel;
    const webhook = await createWebhook(guildId, baseChannel);
    return new discord_js_1.WebhookClient({ id: webhook.id, token: webhook.token });
}
async function getCharacterWithWebhook(userId, name, channel) {
    if (!channel?.guild) {
        throw new Error('Only guild channels are supported for webhooks.');
    }
    const guildId = channel.guild.id;
    const characterData = await (0, characterUtils_1.getCharacterData)(userId, name);
    const webhookClient = await getGuildWebhook(guildId, channel);
    return {
        name: characterData.character_name,
        avatarURL: characterData.avatar_url,
        webhookClient
    };
}
async function sendCharacterMessage({ userId, name, message, channel }) {
    const baseChannel = channel.isThread() ? channel.parent : channel;
    const character = await getCharacterWithWebhook(userId, name, baseChannel);
    const chunks = (0, formatUtils_1.splitMessage)(message);
    const threadId = channel.isThread() ? channel.id : undefined;
    try {
        for (let chunk of chunks) {
            await character.webhookClient.send({
                content: chunk,
                username: character.name,
                avatarURL: character.avatarURL,
                threadId
            });
        }
    }
    catch (error) {
        if (error.code === 10015) { // Unknown Webhook
            console.warn('Webhook missing or invalid. Recreating...');
            const guildId = channel.guild.id;
            await db_1.default.query('DELETE FROM guild_webhooks WHERE guild_id = $1', [guildId]);
            const newWebhookClient = await getGuildWebhook(guildId, baseChannel);
            for (let chunk of chunks) {
                await newWebhookClient.send({
                    content: chunk,
                    username: character.name,
                    avatarURL: character.avatarURL,
                    threadId
                });
            }
        }
        else {
            throw error;
        }
    }
}
async function getStoredWebhookIds() {
    const { rows } = await db_1.default.query('SELECT webhook_id FROM guild_webhooks WHERE webhook_id IS NOT NULL', []);
    return rows.map(row => row.webhook_id);
}
