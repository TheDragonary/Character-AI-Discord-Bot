const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { sendCharacterMessage } = require('../../webhookHandler');
const { extractImageData } = require('../../cardReader');
const { autocompleteCharacters, autocompleteUserCharacters } = require('../../autocomplete');
const { setDefaultCharacter, getFirstMessage } = require('../../utils/dbUtils');
const { normaliseMetadata, formatCharacterList } = require('../../utils/formatUtils');
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

        if (subcommand == 'add') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            try {
                const image = interaction.options.getAttachment('card');
                const userId = interaction.user.id;
                const metadata = await extractImageData(image.url);
                const { charName, description, personality, scenario, first_mes, mes_example } = normaliseMetadata(metadata);
                
                if (!charName) {
                    return await interaction.editReply('❌ Character name is missing or invalid in the card metadata.');
                }

                const { rows: globalRows } = await db.query(
                    'SELECT * FROM characters WHERE character_name = $1 AND user_id IS NULL',
                    [charName]
                );

                if (globalRows.length > 0) {
                    await interaction.editReply(`${charName} is already in the global character list.`);
                    return;
                }

                const { rows } = await db.query(
                    'SELECT * FROM characters WHERE user_id = $1 AND character_name = $2',
                    [userId, charName]
                );

                if (rows.length > 0) {
                    await interaction.editReply(`${charName} is already in your character list.`);
                    return;
                }

                await db.query(
                    `INSERT INTO characters 
                    (user_id, character_name, description, personality, scenario, first_mes, mes_example, avatar_url)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [userId, charName, description, personality, scenario, first_mes, mes_example, image.url]
                );

                await interaction.editReply(`✅ Added **${charName}** to your character list.`);

                const followUpMsg = await interaction.followUp("Click 👋 to send the first message.");

                await followUpMsg.react('👋');

                const filter = (reaction, user) =>
                    reaction.emoji.name === '👋' && user.id === interaction.user.id;

                const collector = followUpMsg.createReactionCollector({ filter, max: 1, time: 30000 });

                collector.on('collect', async () => {
                    const reply = await getFirstMessage(userId, interaction.user.displayName || interaction.user.username, charName);

                    await db.query(
                        `INSERT INTO character_history (user_id, character_name, role, content)
                            VALUES ($1, $2, 'character', $3)`,
                        [userId, charName, reply]
                    );

                    await setDefaultCharacter(userId, charName);

                    await sendCharacterMessage({
                        userId,
                        characterNameOverride: charName,
                        message: reply,
                        channel: interaction.channel
                    });
                });
            } catch (error) {
                console.error(error);
                await interaction.editReply(error.message || 'There was an error while adding the character');
            }

        } else if (subcommand == 'delete') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const userId = interaction.user.id;
            const charName = interaction.options.getString('name');
    
            try {
                const { rows } = await db.query(
                    'SELECT * FROM characters WHERE user_id = $1 AND character_name = $2',
                    [userId, charName]
                );

                if (rows.length === 0) {
                    const { rows: globalRows } = await db.query(
                        'SELECT * FROM characters WHERE character_name = $1 AND user_id IS NULL',
                        [charName]
                    );

                    if (globalRows.length > 0) {
                        await interaction.editReply(`❌ You cannot delete a character from the global character list.`);
                        return;
                    }
                }

                const { rowCount } = await db.query(
                    'DELETE FROM characters WHERE user_id = $1 AND character_name = $2',
                    [userId, charName]
                );
    
                if (rowCount === 0) {
                    await interaction.editReply(`❌ No character named **${charName}** found in your list.`);
                } else {
                    await interaction.editReply(`🗑️ Deleted **${charName}** from your character list.`);
                }
            } catch (err) {
                console.error(err);
                await interaction.editReply('There was an error while deleting the character.');
            }

        } else if (subcommand == 'list') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const userId = interaction.user.id;

            try {
                const { rows: userChars } = await db.query(
                    'SELECT character_name FROM characters WHERE user_id = $1 ORDER BY character_name',
                    [userId]
                );
                const { rows: globalChars } = await db.query(
                    'SELECT character_name FROM characters WHERE user_id IS NULL ORDER BY character_name'
                );

                const userList = formatCharacterList(userChars);
                const globalList = formatCharacterList(globalChars);

                await interaction.editReply(`👤 **Your Characters:**\n${userList}\n\n🌍 **Global Characters:**\n${globalList}`);

            } catch (error) {
                console.error(error);
                await interaction.editReply('Something went wrong while fetching your character list.');
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