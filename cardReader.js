async function extractImageData(imageUrl) {
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    const extractChunks = require('png-chunks-extract');
    const PNGtext = require('png-chunk-text');

    const response = await fetch(imageUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const chunks = extractChunks(buffer);

    let character = null;
    for (const chunk of chunks) {
        if (chunk.name === 'tEXt') {
            const textData = PNGtext.decode(chunk.data);
            if (textData.keyword && textData.keyword.toLowerCase().includes('chara')) {
                character = textData.text;
                break;
            }
        }
    }

    if (!character) {
        throw new Error('Image contains no character card metadata.');
    }

    const decodedString = Buffer.from(character, 'base64').toString('utf-8');
    const metadata = JSON.parse(decodedString);
    return metadata;
};

module.exports = { extractImageData };