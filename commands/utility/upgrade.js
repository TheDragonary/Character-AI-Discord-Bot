const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createCheckoutSessionForUser } = require('../../utils/stripe');
const db = require('../../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('upgrade')
        .setDescription('Upgrade to a paid tier')
        .addStringOption(option =>
            option.setName('tier')
                .setDescription('Select a tier')
                .setRequired(true)
                .setAutocomplete(true)),

    async execute(interaction) {
        const userId = interaction.user.id;
        const selectedTier = interaction.options.getString('tier');

        const result = await db.query(
            `SELECT price_id FROM tiers WHERE tier_name = $1`,
            [selectedTier]
        );

        if (result.rows.length === 0) {
            return await interaction.reply({
                content: `❌ Tier \`${selectedTier}\` not found.`,
                flags: MessageFlags.Ephemeral
            });
        }

        const priceId = result.rows[0].price_id;

        try {
            const paymentUrl = await createCheckoutSessionForUser(userId, priceId);

            await interaction.reply({
                content: `💳 Click below to subscribe to **${selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)}**:\n${paymentUrl}`,
                flags: MessageFlags.Ephemeral
            });
        } catch (err) {
            console.error('Error creating payment link:', err);
            await interaction.reply({
                content: `⚠️ Failed to generate payment link. Please try again later.`,
                flags: MessageFlags.Ephemeral
            });
        }
    },
    
    async autocomplete(interaction) {
        const focused = interaction.options.getFocused().toLowerCase();
        const result = await db.query(`SELECT tier_name FROM tiers WHERE tier_name != 'free'`);

        const choices = result.rows
            .map(row => row.tier_name)
            .filter(name => name.toLowerCase().includes(focused))
            .slice(0, 25);

        await interaction.respond(choices.map(choice => ({
            name: choice.charAt(0).toUpperCase() + choice.slice(1),
            value: choice,
        })));
    }
};