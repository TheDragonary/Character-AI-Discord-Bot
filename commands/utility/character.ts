import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { extractImageData } from '../../cardReader';
import { autocompleteCharacters, autocompleteUserCharacters } from '../../autocomplete';
import { addCharacter, deleteCharacter, getCharacterLists } from '../../utils/characterUtils';
import { normaliseMetadata } from '../../utils/formatUtils';

export const data = new SlashCommandBuilder()
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
            .setDescription('View a list of your characters'));

export async function execute(interaction: any): Promise<void> {
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
            await interaction.editReply(`✅ Added **${name}** to your character list.\nRun \`/chat character:\` to start a new chat with your character.`);
        } catch (error) {
            console.error(error);
            await interaction.editReply(`❌ ${(error as any).message}`);
        }

    } else if (subcommand == 'delete') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const name = interaction.options.getString('name');

        try {
            const deleted = await deleteCharacter(userId, name);
            await interaction.editReply(deleted);
        } catch (error) {
            console.error(error);
            await interaction.editReply(`❌ ${(error as any).message}`);
        }

    } else if (subcommand == 'list') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const { user: userList, global: globalList } = await getCharacterLists(userId);
            await interaction.editReply(`👤 **Your Characters:**\n${userList}\n\n🌍 **Global Characters:**\n${globalList}`);
        } catch (error) {
            console.error(error);
            await interaction.editReply(`❌ ${(error as any).message}`);
        }
    }
}

export async function autocomplete(interaction: any): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'delete') {
        return await autocompleteUserCharacters(interaction, interaction.user.id);
    } else if (subcommand === 'list') {
        return await autocompleteCharacters(interaction, interaction.user.id);
    }
}