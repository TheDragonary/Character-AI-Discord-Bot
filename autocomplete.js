const db = require('./db');

async function autocompleteCharacters(interaction, userId) {
    try {
        const focused = interaction.options.getFocused();
        const { rows } = await db.query(
            `SELECT DISTINCT ON (character_name) character_name
            FROM characters
            WHERE user_id = $1 OR user_id IS NULL
            ORDER BY character_name, user_id DESC`,
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

async function autocompleteGlobalCharacters(interaction) {
    try {
        const focused = interaction.options.getFocused();
        const { rows } = await db.query(
            `SELECT character_name FROM characters WHERE user_id IS NULL ORDER BY character_name`
        );

        const choices = rows.map(row => row.character_name);
        const filtered = choices
            .filter(name => name.toLowerCase().startsWith(focused.toLowerCase()))
            .slice(0, 25);

        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice }))
        );
    } catch (err) {
        console.error('Global character autocomplete failed:', err);
        await interaction.respond([]);
    }
}

async function autocompleteHistory(interaction, userId) {
    try {
        const focused = interaction.options.getFocused();
        const { rows } = await db.query(
            `SELECT DISTINCT character_name FROM character_history 
            WHERE user_id = $1
            UNION ALL
            SELECT DISTINCT character_name FROM characters WHERE user_id IS NULL
            ORDER BY character_name`,
            [userId]
        );

        const uniqueNames = [...new Set(rows.map(row => row.character_name))];
        const filtered = uniqueNames
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

module.exports = { autocompleteCharacters, autocompleteGlobalCharacters, autocompleteHistory };