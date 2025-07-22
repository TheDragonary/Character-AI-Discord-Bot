const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ quiet: true });

const db = require('./db');
const { deleteCharacterThread } = require('./utils/threadUtils');
const { syncOpenRouterModels, syncTierModelAccess } = require('./utils/modelUtils');

const token = process.env.DISCORD_TOKEN;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessageReactions] });

client.commands = new Collection();
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

async function syncModelsAndAccess() {
    await syncOpenRouterModels();
    await syncTierModelAccess();
}

syncModelsAndAccess().catch(console.error);

client.once(Events.ClientReady, async readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.on(Events.ThreadDelete, async thread => {
	try {
		await deleteCharacterThread(thread.id);
	} catch (error) {
		console.error('Error cleaning up thread data:', error);
	}
});

client.on(Events.ChannelDelete, async channel => {
	try {
		if (channel.isThread()) {
			await db.query(`DELETE FROM character_threads WHERE thread_id = $1`, [channel.id]);
		} else {
			await db.query(`
				DELETE FROM character_threads
				WHERE parent_channel_id = $1`,
				[channel.id]
			);
		}
	} catch (error) {
		console.error('Error cleaning up channel data:', error);
	}
});

client.on(Events.GuildDelete, async guild => {
    try {
		await db.query(`DELETE FROM character_threads WHERE guild_id = $1`, [guild.id]);
        await db.query('DELETE FROM guild_settings WHERE guild_id = $1', [guild.id]);
        await db.query('DELETE FROM guild_webhooks WHERE guild_id = $1', [guild.id]);
    } catch (error) {
        console.error('Error cleaning up guild data:', error);
    }
});

client.login(token);