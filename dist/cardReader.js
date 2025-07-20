"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractImageData = extractImageData;
const node_fetch_1 = __importDefault(require("node-fetch"));
const png_chunks_extract_1 = __importDefault(require("png-chunks-extract"));
const png_chunk_text_1 = __importDefault(require("png-chunk-text"));
async function fetchImage(imageUrl) {
    const response = await (0, node_fetch_1.default)(imageUrl);
    if (!response.ok)
        throw new Error(`Failed to fetch image: ${response.statusText}`);
    return Buffer.from(await response.arrayBuffer());
}
async function extractCharacterData(chunks) {
    for (const chunk of chunks) {
        if (chunk.name === 'tEXt') {
            const textData = png_chunk_text_1.default.decode(chunk.data);
            if (textData.keyword && textData.keyword.toLowerCase().includes('chara')) {
                return textData.text;
            }
        }
    }
    return null;
}
async function extractImageData(imageUrl) {
    const buffer = await fetchImage(imageUrl);
    const chunks = (0, png_chunks_extract_1.default)(buffer);
    const character = await extractCharacterData(chunks);
    if (!character)
        throw new Error('Image contains no character card metadata.');
    const decodedString = Buffer.from(character, 'base64').toString('utf-8');
    const metadata = JSON.parse(decodedString);
    if (!metadata.name)
        throw new Error('Character name is missing or invalid in the card metadata.');
    return metadata;
}
;
