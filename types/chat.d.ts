export interface CharacterData {
    character_name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
}

export interface HistoryRow {
    role: 'user' | 'character';
    content: string;
}