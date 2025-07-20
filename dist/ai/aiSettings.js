"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.model = exports.apiKey = exports.baseURL = exports.provider = void 0;
// If you want to use Gemini API, change this to "google"
// Otherwise, keep this as "openai". Changing to anything else would still use OpenAI API
exports.provider = "openai";
// Change to a different URL if not using Mistral, examples are shown below
// https://api.mistral.ai/v1
// https://generativelanguage.googleapis.com/v1beta
// https://openrouter.ai/api/v1
// http://localhost:5001/v1
exports.baseURL = "https://api.mistral.ai/v1";
// If using a different online AI service, change this to your API key stored in ".env"
// Examples: process.env.GEMINI_API_KEY, process.env.MISTRAL_API_KEY
// If using local AI, change this to "0", although it doesn't really matter and you can leave it as-is
exports.apiKey = process.env.MISTRAL_API_KEY;
// If using koboldcpp, change both of these to "koboldcpp"
exports.model = "mistral-medium-latest";
