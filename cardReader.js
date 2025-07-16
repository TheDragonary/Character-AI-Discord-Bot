const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const extractChunks = require('png-chunks-extract');
const PNGtext = require('png-chunk-text');

async function fetchImage(imageUrl) {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    return Buffer.from(await response.arrayBuffer());
}

async function extractCharacterData(chunks) {
    for (const chunk of chunks) {
        if (chunk.name === 'tEXt') {
            const textData = PNGtext.decode(chunk.data);
            if (textData.keyword && textData.keyword.toLowerCase().includes('chara')) {
                return textData.text;
            }
        }
    }
    return null;
}

async function extractImageData(imageUrl) {
    const buffer = await fetchImage(imageUrl);
    const chunks = extractChunks(buffer);
    const character = await extractCharacterData(chunks);
    if (!character) throw new Error('Image contains no character card metadata.');

    const decodedString = Buffer.from(character, 'base64').toString('utf-8');
    const metadata = JSON.parse(decodedString);
    if (!metadata.name) throw new Error('Character name is missing or invalid in the card metadata.');

    return metadata;
};

module.exports = { extractImageData };