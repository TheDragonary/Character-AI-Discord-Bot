import db from './db';

import { AutocompleteInteraction } from 'discord.js';

async function handleAutocomplete(interaction: AutocompleteInteraction, query: string, params: any[] = []): Promise<void> {
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

export async function autocompleteCharacters(interaction: AutocompleteInteraction, userId: string): Promise<void> {
    const query = 
        `SELECT DISTINCT ON (character_name) character_name
        FROM characters
        WHERE user_id = $1 OR user_id IS NULL
        ORDER BY character_name, user_id DESC`;
    await handleAutocomplete(interaction, query, [userId]);
}

export async function autocompleteGlobalCharacters(interaction: any): Promise<void> {
    const query = `SELECT character_name FROM characters WHERE user_id IS NULL ORDER BY character_name`;
    await handleAutocomplete(interaction, query);
}

export async function autocompleteUserCharacters(interaction: any, userId: string): Promise<void> {
    const query = `SELECT character_name FROM characters WHERE user_id = $1 ORDER BY character_name`;
    await handleAutocomplete(interaction, query, [userId]);
}

export async function autocompleteHistory(interaction: any, userId: string): Promise<void> {
    const query = 
        `SELECT DISTINCT character_name FROM character_history 
        WHERE user_id = $1
        UNION ALL
        SELECT DISTINCT character_name FROM characters WHERE user_id IS NULL
        ORDER BY character_name`
    await handleAutocomplete(interaction, query, [userId]);
}
