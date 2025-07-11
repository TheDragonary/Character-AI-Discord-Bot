const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../db');
const { extractImageData } = require('../../cardReader');
const { autocompleteCharacters } = require('../../autocomplete');

const BOT_OWNER_ID = process.env.BOT_OWNER_ID;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('globalcharacter')
        .setDescription('Manage global (shared) characters [BOT OWNER ONLY]')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a global character [BOT OWNER ONLY]')
                .addAttachmentOption(option =>
                    option.setName('card')
                        .setDescription('Character card (.png)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a global character [BOT OWNER ONLY]')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the global character to delete')
                        .setRequired(true)
                        .setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all global characters [BOT OWNER ONLY]')),

    async execute(interaction) {
        if (interaction.user.id !== BOT_OWNER_ID) {
            return await interaction.reply({
                content: '❌ You are not authorised to use this command.',
                flags: MessageFlags.Ephemeral
            });
        }

        const subcommand = interaction.options.getSubcommand();
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (subcommand === 'add') {
            try {
                const image = interaction.options.getAttachment('card');
                const metadata = await extractImageData(image.url);

                const charName = metadata.data?.name || metadata.name;
                const description = metadata.data?.description || metadata.description || '';
                const personality = metadata.data?.personality || metadata.personality || '';
                const scenario = metadata.data?.scenario || metadata.scenario || '';
                const first_mes = metadata.data?.first_mes || metadata.first_mes || '';
                const mes_example = metadata.data?.mes_example || metadata.mes_example || '';

                if (!charName) {
                    return await interaction.editReply('❌ Character name is missing or invalid in the card metadata.');
                }

                const { rows } = await db.query(
                    'SELECT 1 FROM characters WHERE user_id IS NULL AND character_name = $1',
                    [charName]
                );

                if (rows.length > 0) {
                    return await interaction.editReply(`❌ A global character named **${charName}** already exists.`);
                }

                await db.query(
                    `INSERT INTO characters 
                    (user_id, character_name, description, personality, scenario, first_mes, mes_example, avatar_url)
                    VALUES (NULL, $1, $2, $3, $4, $5, $6, $7)`,
                    [charName, description, personality, scenario, first_mes, mes_example, image.url]
                );

                await interaction.editReply(`✅ Global character **${charName}** has been added and is now available to all users.`);
            } catch (error) {
                console.error('Error adding global character:', error);
                await interaction.editReply('❌ Failed to add global character.');
            }

        } else if (subcommand === 'delete') {
            const charName = interaction.options.getString('name');

            try {
                const { rowCount } = await db.query(
                    'DELETE FROM characters WHERE user_id IS NULL AND character_name = $1',
                    [charName]
                );

                if (rowCount === 0) {
                    return await interaction.editReply(`❌ No global character named **${charName}** was found.`);
                }

                await interaction.editReply(`🗑️ Global character **${charName}** has been deleted.`);
            } catch (error) {
                console.error('Error deleting global character:', error);
                await interaction.editReply('❌ Failed to delete global character.');
            }

        } else if (subcommand === 'list') {
            try {
                const { rows } = await db.query(
                    'SELECT character_name FROM characters WHERE user_id IS NULL ORDER BY character_name'
                );

                if (rows.length === 0) {
                    return await interaction.editReply('📭 No global characters found.');
                }

                const list = rows.map((row, i) => `${i + 1}. ${row.character_name}`).join('\n');
                await interaction.editReply(`🌐 **Global Characters:**\n${list}`);
            } catch (error) {
                console.error('Error listing global characters:', error);
                await interaction.editReply('❌ Failed to list global characters.');
            }
        }
    },

    async autocomplete(interaction) {
        const userId = interaction.user.id;
        await autocompleteCharacters(interaction, userId);
    }
};