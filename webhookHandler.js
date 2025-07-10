const { WebhookClient } = require('discord.js');
const db = require('./db');
const { splitMessage } = require('./chatHandler');

async function getCharacterWithWebhook(userId, characterNameOverride, interactionChannel) {
    let charName = characterNameOverride;
    let characterData;

    // Retrieve character
    if (charName) {
        const { rows } = await db.query(
            'SELECT * FROM characters WHERE user_id = $1 AND character_name = $2',
            [userId, charName]
        );
        if (rows.length === 0) {
            throw new Error(`Character "${charName}" not found.`);
        }
        characterData = rows[0];

        await db.query(`
            INSERT INTO user_settings (user_id, default_character)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET default_character = EXCLUDED.default_character
        `, [userId, charName]);
    } else {
        const { rows: settings } = await db.query(
            'SELECT default_character FROM user_settings WHERE user_id = $1',
            [userId]
        );
        if (settings.length === 0 || !settings[0].default_character) {
            throw new Error('No character specified and no default character set.');
        }
        charName = settings[0].default_character;

        const { rows } = await db.query(
            'SELECT * FROM characters WHERE user_id = $1 AND character_name = $2',
            [userId, charName]
        );
        if (rows.length === 0) {
            throw new Error(`Default character "${charName}" not found.`);
        }
        characterData = rows[0];
    }

    let webhookId = characterData.webhook_id;
    let webhookToken = characterData.webhook_token;
    let webhookClient;

    try {
        if (!webhookId || !webhookToken) {
            if (!interactionChannel) {
                throw new Error('No channel provided for webhook creation.');
            }

            const webhook = await interactionChannel.createWebhook({
                name: characterData.character_name,
                avatar: characterData.avatar_url || undefined
            });

            webhookId = webhook.id;
            webhookToken = webhook.token;

            await db.query(
                `UPDATE characters SET webhook_id = $1, webhook_token = $2 WHERE id = $3`,
                [webhookId, webhookToken, characterData.id]
            );

            webhookClient = new WebhookClient({ id: webhookId, token: webhookToken });
        } else {
            // Create client and verify
            webhookClient = new WebhookClient({ id: webhookId, token: webhookToken });

            try {
                const webhooks = await interactionChannel.fetchWebhooks();
                const existingWebhook = webhooks.get(webhookId);

                if (!existingWebhook || existingWebhook.channelId !== interactionChannel.id) {
                    console.warn(`Webhook invalid or in wrong channel. Recreating...`);

                    if (existingWebhook) {
                        await existingWebhook.delete('Rebinding to correct channel');
                    }

                    await db.query(
                        `UPDATE characters SET webhook_id = NULL, webhook_token = NULL WHERE id = $1`,
                        [characterData.id]
                    );

                    return await getCharacterWithWebhook(userId, characterNameOverride, interactionChannel);
                }
            } catch (err) {
                if (err.code === 10015) { // Unknown Webhook
                    await db.query(
                        `UPDATE characters SET webhook_id = NULL, webhook_token = NULL WHERE id = $1`,
                        [characterData.id]
                    );
                    return await getCharacterWithWebhook(userId, characterNameOverride, interactionChannel);
                } else {
                    throw err;
                }
            }
        }
    } catch (error) {
        console.error('Error creating or verifying webhook:', error);
        throw error;
    }

    try {
        const guild = interactionChannel.guild;
        if (guild) {
            const allWebhooks = await guild.fetchWebhooks();
            for (const [id, wh] of allWebhooks) {
                // If same character name but webhook ID differs or channel differs, delete duplicate
                if (
                    wh.name === characterData.character_name &&
                    wh.id !== webhookId &&
                    wh.channelId !== interactionChannel.id
                ) {
                    console.log(`Deleting duplicate webhook "${wh.name}" in #${wh.channel?.name || wh.channelId}`);
                    await wh.delete('Duplicate webhook cleanup');
                }
            }
        }
    } catch (err) {
        console.warn('Failed to clean up duplicate webhooks:', err);
    }

    return {
        name: characterData.character_name,
        avatarURL: characterData.avatar_url,
        webhookClient
    };
}

async function sendCharacterMessage({ userId, characterNameOverride, message, interactionChannel }) {
    let character = await getCharacterWithWebhook(userId, characterNameOverride, interactionChannel);
    const chunks = splitMessage(message);

    try {
        for (let i = 0; i < chunks.length; i++) {
            await character.webhookClient.send({
                content: chunks[i],
                username: character.name,
                avatarURL: character.avatarURL
            });
        }
    } catch (error) {
        if (error.code === 10015) { // Unknown Webhook
            console.warn('Webhook missing. Recreating...');
            await db.query(
                'UPDATE characters SET webhook_id = NULL, webhook_token = NULL WHERE character_name = $1 AND user_id = $2',
                [character.name, userId]
            );

            character = await getCharacterWithWebhook(userId, characterNameOverride, interactionChannel);
            for (let i = 0; i < chunks.length; i++) {
                await character.webhookClient.send({
                    content: chunks[i],
                    username: character.name,
                    avatarURL: character.avatarURL
                });
            }
        } else {
            throw error;
        }
    }
}

module.exports = {
    sendCharacterMessage
};