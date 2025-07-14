const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { extractImageData } = require('../../cardReader');
const { autocompleteGlobalCharacters, autocompleteUserCharacters } = require('../../autocomplete');
const db = require('../../db');

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
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('from')
                        .setDescription('Promote a personal character to global')
                        .setRequired(false)
                        .setAutocomplete(true)))
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
                const card = interaction.options.getAttachment('card');
                const fromChar = interaction.options.getString('from');

                if (!card && !fromChar) {
                    return await interaction.editReply('❌ You must provide either a character card or select a personal character to promote.');
                }
                
                if (card && fromChar) {
                    return await interaction.editReply('❌ Please choose either a card or a personal character — not both.');
                }

                let metadata = {};
                let imageUrl = null;

                if (card) {
                    metadata = await extractImageData(card.url);
                    imageUrl = card.url;
                } else {
                    const { rows } = await db.query(
                        `SELECT * FROM characters WHERE character_name = $1 AND user_id = $2`,
                        [fromChar, interaction.user.id]
                    );
                    if (rows.length === 0) {
                        return await interaction.editReply(`❌ Personal character **${fromChar}** not found.`);
                    }
                    metadata = rows[0];
                    imageUrl = metadata.avatar_url;
                }

                const charName = metadata.character_name || metadata.name;
                if (!charName) {
                    return await interaction.editReply('❌ Character name is missing or invalid.');
                }

                const {
                    description = '',
                    personality = '',
                    scenario = '',
                    first_mes = '',
                    mes_example = ''
                } = metadata;

                const { rows: existingRows } = await db.query(
                    'SELECT * FROM characters WHERE character_name = $1',
                    [charName]
                );

                const existing = existingRows.find(row => row.user_id === interaction.user.id);
                const isPromotion = !!existing;

                if (existingRows.find(row => row.user_id === null)) {
                    return await interaction.editReply(`❌ A global character named **${charName}** already exists.`);
                }

                if (isPromotion) {
                    // Archive personal version before promoting
                    await db.query(
                        `INSERT INTO character_archive (user_id, character_name, description, personality, scenario, first_mes, mes_example, avatar_url)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [existing.user_id, existing.character_name, existing.description, existing.personality,
                        existing.scenario, existing.first_mes, existing.mes_example, existing.avatar_url]
                    );

                    // Delete personal version
                    await db.query(
                        'DELETE FROM characters WHERE character_name = $1 AND user_id = $2',
                        [charName, existing.user_id]
                    );
                }

                await db.query(
                    `INSERT INTO characters 
                    (user_id, character_name, description, personality, scenario, first_mes, mes_example, avatar_url)
                    VALUES (NULL, $1, $2, $3, $4, $5, $6, $7)`,
                    [charName, description, personality, scenario, first_mes, mes_example, imageUrl]
                );

                await interaction.editReply(
                    isPromotion
                        ? `♻️ Personal character **${charName}** was promoted to a global character and updated.`
                        : `✅ Global character **${charName}** has been added.`
                );
            } catch (error) {
                console.error('Error adding global character:', error);
                await interaction.editReply('❌ Failed to add global character.');
            }

        } else if (subcommand === 'delete') {
            const charName = interaction.options.getString('name');

            try {
                // Delete global character
                const { rowCount } = await db.query(
                    'DELETE FROM characters WHERE user_id IS NULL AND character_name = $1',
                    [charName]
                );

                if (rowCount === 0) {
                    return await interaction.editReply(`❌ No global character named **${charName}** was found.`);
                }

                // Attempt to restore from archive
                const { rows: archived } = await db.query(
                    `SELECT * FROM character_archive 
                    WHERE character_name = $1 
                    ORDER BY archived_at DESC LIMIT 1`,
                    [charName]
                );

                if (archived.length > 0) {
                    const a = archived[0];

                    await db.query(
                        `INSERT INTO characters (user_id, character_name, description, personality, scenario, first_mes, mes_example, avatar_url)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [a.user_id, a.character_name, a.description, a.personality, a.scenario, a.first_mes, a.mes_example, a.avatar_url]
                    );

                    await db.query('DELETE FROM character_archive WHERE id = $1', [a.id]);

                    return await interaction.editReply(`🗑️ Global character **${charName}** deleted.\n↩️ Personal version has been restored.`);
                } else {
                    return await interaction.editReply(`🗑️ Global character **${charName}** has been deleted.`);
                }
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
                await interaction.editReply(`🌍 **Global Characters:**\n${list}`);
            } catch (error) {
                console.error('Error listing global characters:', error);
                await interaction.editReply('❌ Failed to list global characters.');
            }
        }
    },

    async autocomplete(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'delete') {
            return await autocompleteGlobalCharacters(interaction);
        } else if (subcommand === 'add') {
            return await autocompleteUserCharacters(interaction, interaction.user.id);
        }
    }
};