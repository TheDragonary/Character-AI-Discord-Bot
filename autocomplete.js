const db = require('./db');

async function handleAutocomplete(interaction, query, params = []) {
    try {
        const focused = interaction.options.getFocused();
        const { rows } = await db.query(query, params);

        const uniqueNames = [...new Set(rows.map(row => row.character_name))];
        const filtered = uniqueNames
            .filter(name => name.toLowerCase().startsWith(focused.toLowerCase()))
            .slice(0, 25);

        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice }))
        );
    } catch (error) {
        console.error('Autocomplete error:', error);
        await interaction.respond([]);
    }
}

async function autocompleteCharacters(interaction, userId) {
    const query = 
        `SELECT DISTINCT ON (character_name) character_name
        FROM characters
        WHERE user_id = $1 OR user_id IS NULL
        ORDER BY character_name, user_id DESC`;
    await handleAutocomplete(interaction, query, [userId]);
}

async function autocompleteGlobalCharacters(interaction) {
    const query = `SELECT character_name FROM characters WHERE user_id IS NULL ORDER BY character_name`;
    await handleAutocomplete(interaction, query);
}

async function autocompleteUserCharacters(interaction, userId) {
    const query = `SELECT character_name FROM characters WHERE user_id = $1 ORDER BY character_name`;
    await handleAutocomplete(interaction, query, [userId]);
}

async function autocompleteHistory(interaction, userId) {
    const query = 
        `SELECT DISTINCT character_name FROM character_history 
        WHERE user_id = $1
        UNION ALL
        SELECT DISTINCT character_name FROM characters WHERE user_id IS NULL
        ORDER BY character_name`
    await handleAutocomplete(interaction, query, [userId]);
}

async function autocompleteModels(interaction) {
    const userId = interaction.user.id;
    
    const tierRes = await db.query(`SELECT tier_name FROM user_tiers WHERE user_id = $1`, [userId]);

    if (tierRes.rowCount === 0) {
        return interaction.respond([
            { name: 'You are on the Free tier — upgrade to select a model', value: 'locked' }
        ]);
    }

    const tierName = tierRes.rows[0].tier_name;

    if (tierName === 'free') {
        return interaction.respond([{ name: 'Model selection not available for free tier', value: 'locked' }]);
    }

    const modelsRes = await db.query(
        `SELECT models.model_name, models.display_name FROM tier_model_access
        JOIN models ON tier_model_access.model_name = models.model_name
        WHERE tier_model_access.tier_name = $1`,
        [tierName]
    );

    const focusedValue = interaction.options.getFocused().toLowerCase();
    const filtered = modelsRes.rows
        .filter(m => m.display_name.toLowerCase().includes(focusedValue))
        .slice(0, 25)
        .map(m => ({ name: m.display_name, value: m.model_name }));

    await interaction.respond(filtered);
}

module.exports = {
    autocompleteCharacters,
    autocompleteGlobalCharacters,
    autocompleteUserCharacters,
    autocompleteHistory,
    autocompleteModels
};