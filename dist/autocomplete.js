"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.autocompleteCharacters = autocompleteCharacters;
exports.autocompleteGlobalCharacters = autocompleteGlobalCharacters;
exports.autocompleteUserCharacters = autocompleteUserCharacters;
exports.autocompleteHistory = autocompleteHistory;
const db_1 = __importDefault(require("./db"));
async function handleAutocomplete(interaction, query, params = []) {
    try {
        const focused = interaction.options.getFocused();
        const { rows } = await db_1.default.query(query, params);
        const uniqueNames = [...new Set(rows.map(row => row.character_name))];
        const filtered = uniqueNames
            .filter(name => name.toLowerCase().startsWith(focused.toLowerCase()))
            .slice(0, 25);
        await interaction.respond(filtered.map(choice => ({ name: choice, value: choice })));
    }
    catch (error) {
        console.error('Autocomplete error:', error);
        await interaction.respond([]);
    }
}
async function autocompleteCharacters(interaction, userId) {
    const query = `SELECT DISTINCT ON (character_name) character_name
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
    const query = `SELECT DISTINCT character_name FROM character_history 
        WHERE user_id = $1
        UNION ALL
        SELECT DISTINCT character_name FROM characters WHERE user_id IS NULL
        ORDER BY character_name`;
    await handleAutocomplete(interaction, query, [userId]);
}
