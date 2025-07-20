import { Client, Collection, Events, GatewayIntentBits } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

import db from './db';
import { deleteCharacterThread } from './utils/threadUtils';

const token = process.env.DISCORD_TOKEN as string;

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMessageReactions
    ] 
});

client.commands = new Collection<string, any>();

(async () => {
    const foldersPath = path.join(__dirname, 'commands');
    const commandFolders = fs.readdirSync(foldersPath);

    for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts'));
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = await import(filePath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
            } else {
                console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        }
    }

    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.ts'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = await import(filePath);
        if (event.once) {
            client.once(event.name, (...args: any[]) => event.execute(...args));
        } else {
            client.on(event.name, (...args: any[]) => event.execute(...args));
        }
    }
})();

client.once(Events.ClientReady, (readyClient) => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.on(Events.ThreadDelete, async (thread) => {
    try {
        await deleteCharacterThread(thread.id);
    } catch (error) {
        console.error('Error deleting thread record:', (error as Error).message);
    }
});

client.on('guildDelete', async (guild) => {
    try {
        await db.query('DELETE FROM guild_settings WHERE guild_id = $1', [guild.id]);
        await db.query('DELETE FROM guild_webhooks WHERE guild_id = $1', [guild.id]);
    } catch (error) {
        console.error('Error cleaning up guild data:', (error as Error).message);
    }
});

client.login(token);