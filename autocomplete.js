const db = require('./db');

async function autocompleteCharacters(interaction, userId) {
  try {
    const focused = interaction.options.getFocused();
    const { rows } = await db.query(
      `SELECT character_name FROM characters WHERE user_id = $1 OR user_id IS NULL`,
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

module.exports = { autocompleteCharacters };