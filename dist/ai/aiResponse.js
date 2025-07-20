"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAIResponse = getAIResponse;
const googleClient_1 = require("./googleClient");
const openaiClient_1 = require("./openaiClient");
async function getAIResponse(provider, ...args) {
    switch (provider) {
        case 'google':
            return await (0, googleClient_1.getGoogleResponse)(args[0]);
        case 'openai':
            return await (0, openaiClient_1.getOpenAIResponse)(args[0]);
        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }
}
