import db from '../db';
import { extractImageData } from '../cardReader';
import { formatCharacterFields, normaliseMetadata, formatCharacterList } from './formatUtils';

export async function fetchCharacter(userId: string, name: string, fields: string = '*'): Promise<any | null> {
    const { rows } = await db.query(
        `SELECT ${fields} FROM characters 
        WHERE character_name = $1 AND (user_id = $2 OR user_id IS NULL)
        ORDER BY user_id NULLS LAST
        LIMIT 1`,
        [name, userId]
    );
    return rows[0] || null;
}

export async function getCharacterData(userId: string, name: string): Promise<any> {
    const character = await fetchCharacter(userId, name);
    if (!character) throw new Error(`Character "${name}" not found.`);
    return character;
}

export async function getFirstMessage(userId: string, username: string, name: string): Promise<string> {
    const character = await fetchCharacter(userId, name, 'first_mes');
    if (!character) throw new Error(`Character "${name}" not found for user ${userId}.`);
    const { first_mes } = formatCharacterFields(character, ['first_mes'], username, name);
    return first_mes;
}

export async function checkCharacterList(userId: string, name: string): Promise<{ isGlobal: boolean, message: string } | null> {
    const character = await fetchCharacter(userId, name, 'user_id');
    if (!character) return null;

    return {
        isGlobal: character.user_id === null,
        message: character.user_id === null ? `${name} is already in the global character list.` : `${name} is already in your character list.`
    };
}

export async function getUserCharacterList(userId: string): Promise<any[]> {
    if (!userId) return [];
    const { rows } = await db.query(
        'SELECT character_name FROM characters WHERE user_id = $1 ORDER BY character_name',
        [userId]
    );
    return rows;
}

export async function getGlobalCharacterList(): Promise<any[]> {
    const { rows } = await db.query(
        'SELECT character_name FROM characters WHERE user_id IS NULL ORDER BY character_name',
        []
    );
    return rows;
}
    
export async function getCharacterLists(userId: string): Promise<{ user: string, global: string }> {
    return {
        user: formatCharacterList(await getUserCharacterList(userId)),
        global: formatCharacterList(await getGlobalCharacterList())
    };
}

export async function addCharacter(userId: string, metadata: any, avatar_url: string): Promise<void> {
    const { name, description, personality, scenario, first_mes, mes_example } = normaliseMetadata(metadata);
    const result = await checkCharacterList(userId, name);
    if (result) throw new Error(result.message);

    await db.query(
        `INSERT INTO characters 
        (user_id, character_name, description, personality, scenario, first_mes, mes_example, avatar_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, name, description, personality, scenario, first_mes, mes_example, avatar_url]
    );
}

export async function deleteCharacter(userId: string, name: string): Promise<string> {
    const character = await fetchCharacter(userId, name, 'user_id');
    if (!character) throw new Error(`No character named **${name}** found in your list.`);
    if (character.user_id === null) throw new Error(`You cannot delete **${name}** from the global character list.`)

    await db.query(
        'DELETE FROM characters WHERE user_id = $1 AND character_name = $2',
        [userId, name]
    );

    return `🗑️ Deleted **${name}** from your character list.`;
}

export async function characterExists(name: string, globalOnly: boolean = false): Promise<boolean> {
    const condition = globalOnly ? 'user_id IS NULL' : 'TRUE';
    const { rows } = await db.query(
        `SELECT 1 FROM characters WHERE character_name = $1 AND ${condition} LIMIT 1`,
        [name]
    );
    return rows.length > 0;
}

export async function promoteCharacterToGlobal(name: string, userId: string, avatar_url: string): Promise<any> {
    const { rows } = await db.query(
        `SELECT * FROM characters WHERE character_name = $1 AND user_id = $2 LIMIT 1`,
        [name, userId]
    );
    if (!rows.length) throw new Error(`Character **${name}** not found in your list.`);

    const personal = rows[0];

    const exists = await characterExists(name, true);
    if (exists) {
        throw new Error(`A global character named **${name}** already exists.`);
    }

    await db.query(
        `INSERT INTO character_archive (user_id, character_name, description, personality, scenario, first_mes, mes_example, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [personal.user_id, personal.character_name, personal.description, personal.personality, personal.scenario, personal.first_mes, personal.mes_example, personal.avatar_url]
    );

    await db.query(
        'DELETE FROM characters WHERE character_name = $1 AND user_id = $2',
        [name, userId]
    );

    await db.query(
        `INSERT INTO characters 
         (user_id, character_name, description, personality, scenario, first_mes, mes_example, avatar_url)
         VALUES (NULL, $1, $2, $3, $4, $5, $6, $7)`,
        [personal.character_name, personal.description, personal.personality,
         personal.scenario, personal.first_mes, personal.mes_example, avatar_url ?? personal.avatar_url]
    );

    return personal;
}

export async function restoreArchivedCharacter(name: string): Promise<boolean> {
    const { rows } = await db.query(
        `SELECT * FROM character_archive 
         WHERE character_name = $1 
         ORDER BY archived_at DESC LIMIT 1`,
        [name]
    );

    if (!rows.length) return false;
    const archived = rows[0];

    await db.query(
        `INSERT INTO characters 
         (user_id, character_name, description, personality, scenario, first_mes, mes_example, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [archived.user_id, archived.character_name, archived.description, archived.personality,
        archived.scenario, archived.first_mes, archived.mes_example, archived.avatar_url]
    );

    await db.query('DELETE FROM character_archive WHERE id = $1', [archived.id]);
    return true;
}

export async function getMetadata(card: any, personalCharacterName: string, userId: string): Promise<{ metadata: any, imageUrl: string, isPromotion: boolean }> {
    let metadata;
    let imageUrl;

    if (card) {
        metadata = await extractImageData(card.url);
        imageUrl = card.url;
    } else {
        const { rows } = await db.query(
            `SELECT * FROM characters WHERE character_name = $1 AND user_id = $2 LIMIT 1`,
            [personalCharacterName, userId]
        );

        if (!rows.length) {
            throw new Error(`Personal character **${personalCharacterName}** not found.`);
        }

        metadata = rows[0];
        imageUrl = metadata.avatar_url;
    }

    const normalised = normaliseMetadata(metadata);
    if (!normalised.name) {
        throw new Error('Character name is missing or invalid.');
    }

    return { metadata: normalised, imageUrl, isPromotion: !card };
}
