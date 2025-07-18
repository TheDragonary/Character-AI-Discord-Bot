const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { sendCharacterMessage } = require('../../webhookHandler');
const { extractImageData } = require('../../cardReader');
const { autocompleteCharacters, autocompleteUserCharacters } = require('../../autocomplete');
const { getFirstMessage, addCharacter, deleteCharacter, getCharacterLists } = require('../../utils/characterUtils');
const { addCharacterHistory, checkHistoryExists } = require('../../utils/characterHistoryUtils');
const { normaliseMetadata } = require('../../utils/formatUtils');
const db = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('character')
        .setDescription('Manage your characters')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a character to your list')
                .addAttachmentOption(option =>
            option.setName('card')
                .setDescription('Character card (.png)')
                .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a character from your list')
                .addStringOption(option =>
            option.setName('name')
                .setDescription('Name of the character to delete')
                .setRequired(true)
                .setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('View a list of your characters')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (subcommand == 'add') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            try {
                const image = interaction.options.getAttachment('card');
                const metadata = await extractImageData(image.url);
                const { name } = normaliseMetadata(metadata);
                if (!name) throw new Error('Character name is missing or invalid in the card metadata.');

                await addCharacter(userId, metadata, image.url);
                await interaction.editReply(`✅ Added **${name}** to your character list.`);

                const followUpMsg = await interaction.followUp("Click 👋 to send the first message.");
                await followUpMsg.react('👋');

                const filter = (reaction, user) =>
                    reaction.emoji.name === '👋' && user.id === interaction.user.id;

                const collector = followUpMsg.createReactionCollector({ filter, max: 1, time: 30000 });
                collector.on('collect', async () => {
                    const reply = await getFirstMessage(userId, interaction.user.displayName || interaction.user.username, name);

                    if (!(await checkHistoryExists(userId, name))) await addCharacterHistory(userId, name, 'character', reply);

                    await sendCharacterMessage({
                        userId,
                        characterNameOverride: name,
                        message: reply,
                        channel: interaction.channel
                    });
                });
            } catch (error) {
                console.error(error);
                await interaction.editReply(`❌ ${error.message}`);
            }

        } else if (subcommand == 'delete') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const name = interaction.options.getString('name');
    
            try {
                const deleted = await deleteCharacter(userId, name);
                await interaction.editReply(deleted);
            } catch (error) {
                console.error(error);
                await interaction.editReply(`❌ ${error.message}`);
            }

        } else if (subcommand == 'list') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            try {
                const { user: userList, global: globalList } = await getCharacterLists(userId);
                await interaction.editReply(`👤 **Your Characters:**\n${userList}\n\n🌍 **Global Characters:**\n${globalList}`);
            } catch (error) {
                console.error(error);
                await interaction.editReply(`❌ ${error.message}`);
            }
        }
    },

    async autocomplete(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'delete') {
            return await autocompleteUserCharacters(interaction, interaction.user.id);
        } else if (subcommand === 'list') {
            return await autocompleteCharacters(interaction, interaction.user.id);
        }
    }
};