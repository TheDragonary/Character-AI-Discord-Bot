import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { autocompleteGlobalCharacters, autocompleteUserCharacters } from '../../autocomplete';
import { getCharacterLists, promoteCharacterToGlobal, restoreArchivedCharacter, characterExists, getMetadata } from '../../utils/characterUtils';
import db from '../../db';

const BOT_OWNER_ID = process.env.BOT_OWNER_ID;

export default {
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

    async execute(interaction: ChatInputCommandInteraction) {
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
                const personalCharacterName = interaction.options.getString('from');

                if (!card && !personalCharacterName) {
                    return await interaction.editReply('❌ You must provide either a character card or select a personal character to promote.');
                }
                
                if (card && personalCharacterName) {
                    return await interaction.editReply('❌ Please choose either a card or a personal character — not both.');
                }

                const { metadata, imageUrl, isPromotion } = await getMetadata(card, personalCharacterName || '', interaction.user.id);
                const { name, description, personality, scenario, first_mes, mes_example } = metadata;

                if (card) {
                    const exists = await characterExists(name);
                    if (exists) {
                        return await interaction.editReply(`❌ A character named **${name}** already exists in your personal or global list. Use \`/globalcharacter add from:\` to promote or delete it first.`);
                    }
                }

                if (isPromotion) {
                    await promoteCharacterToGlobal(name, interaction.user.id, imageUrl);
                } else {
                    await db.query(
                        `INSERT INTO characters 
                        (user_id, character_name, description, personality, scenario, first_mes, mes_example, avatar_url)
                        VALUES (NULL, $1, $2, $3, $4, $5, $6, $7)`,
                        [name, description, personality, scenario, first_mes, mes_example, imageUrl]
                    );
                }

                await interaction.editReply(
                    isPromotion
                        ? `♻️ Personal character **${name}** was promoted to a global character and updated.`
                        : `✅ Global character **${name}** has been added.`
                );
            } catch (error) {
                console.error('Error adding global character:', error);
                await interaction.editReply(`❌ Failed to add global character: ${(error as Error).message}`);
            }

        } else if (subcommand === 'delete') {
            const name = interaction.options.getString('name');

            try {
                const deleted = await db.query(
                    'DELETE FROM characters WHERE user_id IS NULL AND character_name = $1',
                    [name]
                );

                if (deleted.rowCount === 0) {
                    return await interaction.editReply(`❌ No global character named **${name}** was found.`);
                }

                const restored = await restoreArchivedCharacter(name || '');
                return await interaction.editReply(
                    restored
                        ? `🗑️ Global character **${name}** deleted.\n↩️ Personal version has been restored.`
                        : `🗑️ Global character **${name}** has been deleted.`
                );
            } catch (error) {
                console.error('Error deleting global character:', error);
                await interaction.editReply(`❌ Failed to delete global character: ${(error as Error).message}`);
            }

        } else if (subcommand === 'list') {
            try {
                const { global: list } = await getCharacterLists(interaction.user.id);
                await interaction.editReply(`🌍 **Global Characters:**\n${list}`);
            } catch (error) {
                console.error('Error listing global characters:', error);
                await interaction.editReply(`❌ Failed to list global characters: ${(error as Error).message}`);
            }
        }
    },

    async autocomplete(interaction: AutocompleteInteraction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'delete') {
            return await autocompleteGlobalCharacters(interaction);
        } else if (subcommand === 'add') {
            return await autocompleteUserCharacters(interaction, interaction.user.id);
        }
    }
};