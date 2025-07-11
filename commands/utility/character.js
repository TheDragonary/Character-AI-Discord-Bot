const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../db');
const { sendFirstMessage } = require('../../webhookHandler.js');

async function extractImageData(imageUrl) {
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    const extractChunks = require('png-chunks-extract');
    const PNGtext = require('png-chunk-text');

    const response = await fetch(imageUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const chunks = extractChunks(buffer);

    let character = null;
    for (const chunk of chunks) {
        if (chunk.name === 'tEXt') {
            const textData = PNGtext.decode(chunk.data);
            if (textData.keyword && textData.keyword.toLowerCase().includes('chara')) {
                character = textData.text;
                break;
            }
        }
    }

    if (!character) {
        throw new Error('Image contains no character card metadata.');
    }

    const decodedString = Buffer.from(character, 'base64').toString('utf-8');
    const metadata = JSON.parse(decodedString);
    return metadata;
};

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
                .setDescription('Import a character card PNG file')
                .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a character from your list')
                .addStringOption(option =>
            option.setName('name')
                .setDescription('The name of the character to delete')
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

                const metadata = await extractImageData(image.url);

                const userId = interaction.user.id;
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

                const replyMsg = await interaction.editReply(`✅ Added **${charName}** to your character list. Click 👋 to send the first message.`);

                await replyMsg.react('👋');

                const filter = (reaction, user) =>
                    reaction.emoji.name === '👋' && user.id === interaction.user.id;

                const collector = replyMsg.createReactionCollector({ filter, max: 1, time: 30000 });

                collector.on('collect', async () => {
                    await sendFirstMessage(userId, charName, interaction.channel);
                });
            } catch (error) {
                console.error(error);
                await interaction.editReply('There was an error while adding the character.');
            }

        } else if (subcommand == 'delete') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const userId = interaction.user.id;
            const charName = interaction.options.getString('name');
    
            try {
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
                const { rows } = await db.query(
                    'SELECT character_name FROM characters WHERE user_id = $1',
                    [userId]
                );

                if (rows.length === 0) {
                    await interaction.editReply("You haven't added any characters yet.");
                    return;
                }

                const list = rows.map((row, i) => `${i + 1}. ${row.character_name}`).join('\n');

                await interaction.editReply(`👤 **Your Characters:**\n${list}`);
            } catch (error) {
                console.error(error);
                await interaction.editReply('Something went wrong while fetching your character list.');
            }
        }
    },

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused();
        const userId = interaction.user.id;

        try {
            const { rows } = await db.query(
                'SELECT character_name FROM characters WHERE user_id = $1',
                [userId]
            );

            const choices = rows.map(row => row.character_name);
            const filtered = choices
                .filter(name => name.toLowerCase().startsWith(focused.toLowerCase()))
                .slice(0, 25);

            await interaction.respond(
                filtered.map(choice => ({ name: choice, value: choice }))
            );
        } catch (err) {
            console.error('Autocomplete failed:', err);
            await interaction.respond([]);
        }
    }
};