const { WebhookClient } = require('discord.js');
const { splitMessage } = require('./chatHandler');
const db = require('./db');

async function getGuildWebhook(guildId, interactionChannel) {
    // Try to get webhook info for the guild
    const { rows } = await db.query(
        'SELECT webhook_id, webhook_token FROM guild_webhooks WHERE guild_id = $1',
        [guildId]
    );

    if (rows.length > 0) {
        const { webhook_id, webhook_token } = rows[0];
        return new WebhookClient({ id: webhook_id, token: webhook_token });
    }

    // No webhook stored, create one
    if (!interactionChannel) throw new Error('No channel provided for webhook creation.');

    const webhook = await interactionChannel.createWebhook({
        name: 'Character Bot Webhook',
        avatar: null
    });

    await db.query(
        `INSERT INTO guild_webhooks (guild_id, webhook_id, webhook_token)
         VALUES ($1, $2, $3)
         ON CONFLICT (guild_id) DO UPDATE SET webhook_id = EXCLUDED.webhook_id, webhook_token = EXCLUDED.webhook_token`,
        [guildId, webhook.id, webhook.token]
    );

    return new WebhookClient({ id: webhook.id, token: webhook.token });
}

async function getCharacterWithWebhook(userId, characterNameOverride, interactionChannel) {
    if (!interactionChannel?.guild) {
        throw new Error('Only guild channels are supported for webhooks.');
    }

    const guildId = interactionChannel.guild.id;

    // Get character data
    let charName = characterNameOverride;
    let characterData;

    if (!charName) {
        const { rows } = await db.query(
            'SELECT default_character FROM user_settings WHERE user_id = $1',
            [userId]
        );
        if (!rows.length || !rows[0].default_character) {
            throw new Error('No character specified and no default character set.');
        }
        charName = rows[0].default_character;
    }

    const { rows: characterRows } = await db.query(
        `SELECT * FROM characters 
        WHERE (user_id = $1 OR user_id IS NULL) AND character_name = $2
        ORDER BY user_id NULLS LAST
        LIMIT 1`,
        [userId, charName]
    );

    if (!characterRows.length) {
        throw new Error(`Character "${charName}" not found.`);
    }

    characterData = characterRows[0];

    // Get or create webhook for the guild
    let webhookId, webhookToken;
    let webhookClient;

    const { rows: webhookRows } = await db.query(
        'SELECT webhook_id, webhook_token FROM guild_webhooks WHERE guild_id = $1',
        [guildId]
    );

    if (webhookRows.length) {
        webhookId = webhookRows[0].webhook_id;
        webhookToken = webhookRows[0].webhook_token;
        webhookClient = new WebhookClient({ id: webhookId, token: webhookToken });

        try {
            const existing = await interactionChannel.client.fetchWebhook(webhookId);
            if (!existing || existing.channelId !== interactionChannel.id) {
                throw new Error('Invalid or misplaced webhook, recreating...');
            }
        } catch {
            webhookId = null;
            webhookToken = null;
        }
    }

    // If invalid or missing, create webhook
    if (!webhookId || !webhookToken) {
        const webhook = await interactionChannel.createWebhook({
            name: 'Character Bot Webhook',
            avatar: null
        });

        webhookId = webhook.id;
        webhookToken = webhook.token;
        webhookClient = new WebhookClient({ id: webhookId, token: webhookToken });

        await db.query(`
            INSERT INTO guild_webhooks (guild_id, webhook_id, webhook_token)
            VALUES ($1, $2, $3)
            ON CONFLICT (guild_id) DO UPDATE
            SET webhook_id = EXCLUDED.webhook_id, webhook_token = EXCLUDED.webhook_token
        `, [guildId, webhookId, webhookToken]);
    }

    // Delete any other bot-owned webhooks in the server
    try {
        const allWebhooks = await interactionChannel.guild.fetchWebhooks();
        for (const wh of allWebhooks.values()) {
            if (wh.id !== webhookId && wh.owner?.id === interactionChannel.client.user.id) {
                await wh.delete('Enforcing single webhook per guild');
            }
        }
    } catch (err) {
        console.warn('Webhook cleanup failed:', err);
    }

    return {
        name: characterData.character_name,
        avatarURL: characterData.avatar_url,
        webhookClient
    };
}

async function sendCharacterMessage({ userId, characterNameOverride, message, interactionChannel }) {
    const character = await getCharacterWithWebhook(userId, characterNameOverride, interactionChannel);
    const chunks = splitMessage(message);

    try {
        for (let chunk of chunks) {
            await character.webhookClient.send({
                content: chunk,
                username: character.name,
                avatarURL: character.avatarURL
            });
        }
    } catch (error) {
        if (error.code === 10015) { // Unknown Webhook
            console.warn('Webhook missing or invalid. Recreating...');
            // Reset stored webhook for the guild
            const guildId = interactionChannel.guild.id;
            await db.query(
                'DELETE FROM guild_webhooks WHERE guild_id = $1',
                [guildId]
            );

            const newWebhookClient = await getGuildWebhook(guildId, interactionChannel);

            for (let chunk of chunks) {
                await newWebhookClient.send({
                    content: chunk,
                    username: character.name,
                    avatarURL: character.avatarURL
                });
            }
        } else {
            throw error;
        }
    }
}

async function getStoredWebhookIds() {
    // Returns all webhook IDs stored across all guilds
    const { rows } = await db.query('SELECT webhook_id FROM guild_webhooks WHERE webhook_id IS NOT NULL');
    return rows.map(row => row.webhook_id);
}

async function getFirstMessage(userId, username, charName) {
    if (!charName) {
        const { rows } = await db.query(
            'SELECT default_character FROM user_settings WHERE user_id = $1',
            [userId]
        );
        if (!rows.length || !rows[0].default_character) {
            throw new Error('No character specified and no default character set.');
        }
        charName = rows[0].default_character;
    }

    const { rows } = await db.query(
        `SELECT first_mes FROM characters 
        WHERE (user_id = $1 OR user_id IS NULL) AND character_name = $2
        ORDER BY user_id NULLS LAST
        LIMIT 1`,
        [userId, charName]
    );

    if (!rows.length) {
        throw new Error(`Character "${charName}" not found for user ${userId}.`);
    }

    const safeReplace = (str) =>
        str.replace(/\{\{user\}\}/gi, username).replace(/\{\{char\}\}/gi, charName);

    return first_mes = safeReplace(rows[0]?.first_mes);
}

module.exports = {
    sendCharacterMessage,
    getStoredWebhookIds,
    getFirstMessage
};