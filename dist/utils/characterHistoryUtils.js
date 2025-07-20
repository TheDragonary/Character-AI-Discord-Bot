"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCharacterHistory = getCharacterHistory;
exports.addCharacterHistory = addCharacterHistory;
const db_1 = __importDefault(require("../db"));
async function getCharacterHistory(userId, name, limit) {
    let query = `
        SELECT role, content FROM character_history
        WHERE user_id = $1 AND character_name = $2
        ORDER BY id ASC
    `;
    const params = [userId, name];
    if (limit && Number.isInteger(limit)) {
        query += ' LIMIT $3';
        params.push(limit.toString());
    }
    const { rows } = await db_1.default.query(query, params);
    return rows;
}
async function addCharacterHistory(userId, name, role, content) {
    await db_1.default.query('INSERT INTO character_history (user_id, character_name, role, content) VALUES ($1, $2, $3, $4)', [userId, name, role, content]);
}
