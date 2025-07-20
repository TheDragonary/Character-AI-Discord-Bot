"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
exports.autocomplete = autocomplete;
const discord_js_1 = require("discord.js");
const cardReader_1 = require("../../cardReader");
const autocomplete_1 = require("../../autocomplete");
const characterUtils_1 = require("../../utils/characterUtils");
const formatUtils_1 = require("../../utils/formatUtils");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('character')
    .setDescription('Manage your characters')
    .addSubcommand(subcommand => subcommand
    .setName('add')
    .setDescription('Add a character to your list')
    .addAttachmentOption(option => option.setName('card')
    .setDescription('Character card (.png)')
    .setRequired(true)))
    .addSubcommand(subcommand => subcommand
    .setName('delete')
    .setDescription('Delete a character from your list')
    .addStringOption(option => option.setName('name')
    .setDescription('Name of the character to delete')
    .setRequired(true)
    .setAutocomplete(true)))
    .addSubcommand(subcommand => subcommand
    .setName('list')
    .setDescription('View a list of your characters'));
async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    if (subcommand == 'add') {
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const image = interaction.options.getAttachment('card');
            const metadata = await (0, cardReader_1.extractImageData)(image.url);
            const { name } = (0, formatUtils_1.normaliseMetadata)(metadata);
            if (!name)
                throw new Error('Character name is missing or invalid in the card metadata.');
            await (0, characterUtils_1.addCharacter)(userId, metadata, image.url);
            await interaction.editReply(`✅ Added **${name}** to your character list.\nRun \`/chat character:\` to start a new chat with your character.`);
        }
        catch (error) {
            console.error(error);
            await interaction.editReply(`❌ ${error.message}`);
        }
    }
    else if (subcommand == 'delete') {
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        const name = interaction.options.getString('name');
        try {
            const deleted = await (0, characterUtils_1.deleteCharacter)(userId, name);
            await interaction.editReply(deleted);
        }
        catch (error) {
            console.error(error);
            await interaction.editReply(`❌ ${error.message}`);
        }
    }
    else if (subcommand == 'list') {
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const { user: userList, global: globalList } = await (0, characterUtils_1.getCharacterLists)(userId);
            await interaction.editReply(`👤 **Your Characters:**\n${userList}\n\n🌍 **Global Characters:**\n${globalList}`);
        }
        catch (error) {
            console.error(error);
            await interaction.editReply(`❌ ${error.message}`);
        }
    }
}
async function autocomplete(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'delete') {
        return await (0, autocomplete_1.autocompleteUserCharacters)(interaction, interaction.user.id);
    }
    else if (subcommand === 'list') {
        return await (0, autocomplete_1.autocompleteCharacters)(interaction, interaction.user.id);
    }
}
