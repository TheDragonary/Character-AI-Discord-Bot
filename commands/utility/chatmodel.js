const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { setUserSettings } = require('../../utils/userUtils');
const { autocompleteModels } = require('../../autocomplete');
const db = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chatmodel')
        .setDescription('Set your preferred model (for Peasant tier and above)')
        .addStringOption(option =>
            option.setName('model')
                .setDescription('Model to use')
                .setRequired(true)
                .setAutocomplete(true)),

    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const selectedModel = interaction.options.getString('model');
            
            const tierRes = await db.query(`SELECT tier_name FROM user_tiers WHERE user_id = $1`, [userId]);

            if (tierRes.rowCount === 0) {
                await db.query(`INSERT INTO user_tiers (user_id, tier_name) VALUES ($1, 'free')`, [userId]);
                return interaction.reply({
                    content: 'You have been assigned the **Free** tier. Upgrade your tier to choose a model.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const tierName = tierRes.rows[0].tier_name;

            if (tierName === 'free') {
                return interaction.reply({
                    content: 'Model selection is not available for free tier.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const accessRes = await db.query(
                `SELECT 1 FROM tier_model_access
                JOIN tiers ON tier_model_access.tier_name = tiers.tier_name
                WHERE model_name = $1 
                AND tiers.monthly_price <= (SELECT monthly_price FROM tiers WHERE tier_name = $2)
                LIMIT 1`,
                [selectedModel, tierName]
            );

            if (accessRes.rowCount === 0) {
                return interaction.reply({
                    content: 'You do not have access to this model.',
                    flags: MessageFlags.Ephemeral
                });
            }

            await setUserSettings(userId, selectedModel);

            return interaction.reply({
                content: `Model set to \`${selectedModel}\` successfully.`,
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error(error);
            return interaction.reply(error.message);
        }
    },

    async autocomplete(interaction) {
        const userId = interaction.user.id;
        await autocompleteModels(interaction, userId);
    }
};