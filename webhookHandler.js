const { WebhookClient } = require('discord.js');
const { splitMessage } = require('./chatHandler');
const db = require('./db');

async function getWebhookInfo(guildId) {
    const { rows } = await db.query(
        'SELECT webhook_id, webhook_token FROM guild_webhooks WHERE guild_id = $1',
        [guildId]
    );
    return rows.length > 0 ? rows[0] : null;
}

async function createWebhook(guildId, interactionChannel) {
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

    return webhook;
}

async function getGuildWebhook(guildId, interactionChannel) {
    const webhookInfo = await getWebhookInfo(guildId);

    if (webhookInfo) {
        return new WebhookClient({ id: webhookInfo.webhook_id, token: webhookInfo.webhook_token });
    }
    
    const webhook = await createWebhook(guildId, interactionChannel);
    return new WebhookClient({ id: webhook.id, token: webhook.token });
}

async function getCharacterData(userId, charName) {
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

    return characterRows[0];
}

async function getCharacterWithWebhook(userId, charName, interactionChannel) {
    if (!interactionChannel?.guild) {
        throw new Error('Only guild channels are supported for webhooks.');
    }

    const guildId = interactionChannel.guild.id;
    const characterData = await getCharacterData(userId, charName);
    const webhookClient = await getGuildWebhook(guildId, interactionChannel);

    return {
        name: characterData.character_name,
        avatarURL: characterData.avatar_url,
        webhookClient
    };
}

async function sendCharacterMessage({ userId, charName, message, interactionChannel }) {
    const character = await getCharacterWithWebhook(userId, charName, interactionChannel);
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

    return safeReplace(rows[0]?.first_mes);
}

module.exports = {
    sendCharacterMessage,
    getStoredWebhookIds,
    getFirstMessage
};