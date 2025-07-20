"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
require("dotenv/config");
const db_1 = __importDefault(require("./db"));
const threadUtils_1 = require("./utils/threadUtils");
const token = process.env.DISCORD_TOKEN;
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
        discord_js_1.GatewayIntentBits.GuildMessageReactions
    ]
});
client.commands = new discord_js_1.Collection();
(async () => {
    const foldersPath = node_path_1.default.join(__dirname, 'commands');
    const commandFolders = node_fs_1.default.readdirSync(foldersPath);
    for (const folder of commandFolders) {
        const commandsPath = node_path_1.default.join(foldersPath, folder);
        const commandFiles = node_fs_1.default.readdirSync(commandsPath).filter(file => file.endsWith('.ts'));
        for (const file of commandFiles) {
            const filePath = node_path_1.default.join(commandsPath, file);
            const command = await import(filePath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
            }
            else {
                console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        }
    }
    const eventsPath = node_path_1.default.join(__dirname, 'events');
    const eventFiles = node_fs_1.default.readdirSync(eventsPath).filter(file => file.endsWith('.ts'));
    for (const file of eventFiles) {
        const filePath = node_path_1.default.join(eventsPath, file);
        const event = await import(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        }
        else {
            client.on(event.name, (...args) => event.execute(...args));
        }
    }
})();
client.once(discord_js_1.Events.ClientReady, (readyClient) => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});
client.on(discord_js_1.Events.ThreadDelete, async (thread) => {
    try {
        await (0, threadUtils_1.deleteCharacterThread)(thread.id);
    }
    catch (error) {
        console.error('Error deleting thread record:', error.message);
    }
});
client.on('guildDelete', async (guild) => {
    try {
        await db_1.default.query('DELETE FROM guild_settings WHERE guild_id = $1', [guild.id]);
        await db_1.default.query('DELETE FROM guild_webhooks WHERE guild_id = $1', [guild.id]);
    }
    catch (error) {
        console.error('Error cleaning up guild data:', error.message);
    }
});
client.login(token);
