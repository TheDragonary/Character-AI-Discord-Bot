import { WebhookClient } from 'discord.js';
import { getCharacterData } from './utils/characterUtils';
import { splitMessage } from './utils/formatUtils';
import db from './db';

export async function getWebhookInfo(guildId: string): Promise<any | null> {
    const { rows } = await db.query(
        'SELECT channel_id, webhook_id, webhook_token FROM guild_webhooks WHERE guild_id = $1',
        [guildId]
    );
    return rows.length > 0 ? rows[0] : null;
}

export async function createWebhook(guildId: string, channel: any): Promise<any> {
    if (!channel) throw new Error('No channel provided for webhook creation.');

    const existing = await getWebhookInfo(guildId);

    if (existing) {
        try {
            const oldWebhook = new WebhookClient({ id: existing.webhook_id, token: existing.webhook_token });
            await oldWebhook.delete();
        } catch (error) {
            console.warn('Failed to delete old webhook from Discord:', (error as any).message);
        }

        await db.query('DELETE FROM guild_webhooks WHERE guild_id = $1', [guildId]);
    }

    const webhook = await channel.createWebhook({
        name: 'Character Bot Webhook',
        avatar: null
    });

    await db.query(
        `INSERT INTO guild_webhooks (guild_id, channel_id, webhook_id, webhook_token)
         VALUES ($1, $2, $3, $4)`,
        [guildId, channel.id, webhook.id, webhook.token]
    );

    return webhook;
}

export async function getGuildWebhook(guildId: string, channel: any): Promise<any> {
    const webhookInfo = await getWebhookInfo(guildId);

    if (webhookInfo && webhookInfo.channel_id === channel.id) {
        return new WebhookClient({ id: webhookInfo.webhook_id, token: webhookInfo.webhook_token });
    }
    
    const baseChannel = channel.isThread() ? channel.parent : channel;
    const webhook = await createWebhook(guildId, baseChannel);

    return new WebhookClient({ id: webhook.id, token: webhook.token });
}

export async function getCharacterWithWebhook(userId: string, name: string, channel: any): Promise<{ name: string, avatarURL: string, webhookClient: any }> {
    if (!channel?.guild) {
        throw new Error('Only guild channels are supported for webhooks.');
    }

    const guildId = channel.guild.id;
    const characterData = await getCharacterData(userId, name);
    const webhookClient = await getGuildWebhook(guildId, channel);

    return {
        name: characterData.character_name,
        avatarURL: characterData.avatar_url,
        webhookClient
    };
}

export async function sendCharacterMessage({ userId, name, message, channel }: { userId: string, name: string, message: string, channel: any }): Promise<void> {
    const baseChannel = channel.isThread() ? channel.parent : channel;
    const character = await getCharacterWithWebhook(userId, name, baseChannel);
    const chunks = splitMessage(message);
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
    } catch (error) {
        if ((error as any).code === 10015) { // Unknown Webhook
            console.warn('Webhook missing or invalid. Recreating...');

            const guildId = channel.guild.id;
            await db.query('DELETE FROM guild_webhooks WHERE guild_id = $1', [guildId]);

            const newWebhookClient = await getGuildWebhook(guildId, baseChannel);

            for (let chunk of chunks) {
                await newWebhookClient.send({
                    content: chunk,
                    username: character.name,
                    avatarURL: character.avatarURL,
                    threadId
                });
            }
        } else {
            throw error;
        }
    }
}

export async function getStoredWebhookIds(): Promise<string[]> {
    const { rows } = await db.query('SELECT webhook_id FROM guild_webhooks WHERE webhook_id IS NOT NULL', []);
    return rows.map(row => row.webhook_id);
}
