const { Events, MessageFlags } = require('discord.js');
const { baseURL, apiKey, model, visionModel } = require('../aiSettings.js');
const OpenAI = require('openai');
const openai = new OpenAI({ 
    baseURL: baseURL,
    apiKey: apiKey
});
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const path = require('path');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || message.system || message.flags.has(MessageFlags.HasSnapshot)) return;

        try {
            const mention = message.mentions.has(message.client.user);
            const reply = message.reference && (await message.fetchReference())?.author?.id === message.client.user.id;

            if (mention || reply) {
                await message.channel.sendTyping();

                let prompt = message.content.replace(/<@!?(\d+)>/, '').trim();
                let finalPrompt = prompt;
                let imageUrl;
                let reply;

                if (message.attachments.size > 0) imageUrl = message.attachments.first().url;
                if (message.reference) {
                    try {
                        const repliedMessage = await message.fetchReference();
                        if (repliedMessage.attachments.size > 0) {
                            imageUrl = repliedMessage.attachments.first().url;
                        }
                        if (repliedMessage.content) {
                            finalPrompt = `Referenced message from ${repliedMessage.author.username}: ${repliedMessage.content}\nPrompt: ${prompt}`;
                            console.log(`Replying with context from previous message. ${finalPrompt}`);
                        }
                    } catch (err) {
                        console.error("Failed to fetch referenced message:", err);
                    }
                }

                if (imageUrl) {
                    try {
                        console.log(`Model used: ${visionModel}, Location: ${message.guild.name} - ${message.channel.name}, Prompt: ${prompt}\nImage URL: ${imageUrl}`);

                        const responseImg = await fetch(imageUrl);
                        const arrayBuffer = await responseImg.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);
                        const ext = path.extname(imageUrl).toLowerCase();
                        let mimeType = 'image/png';
                        if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
                        else if (ext === '.webp') mimeType = 'image/webp';
                        else if (ext === '.gif') mimeType = 'image/gif';
                        const base64 = buffer.toString('base64');
                        const base64Url = `data:${mimeType};base64,${base64}`;

                        reply = await openai.chat.completions.create({
                            model: visionModel,  
                            messages: [
                                {
                                    role: 'user',
                                    content: [
                                        { type: 'text', text: finalPrompt },
                                        { type: 'image_url', image_url: { url: base64Url } }
                                    ]
                                }
                            ],
                            temperature: 1.0
                        });

                        reply = reply.choices[0].message.content;
                    } catch (err) {
                        console.error("Image analysis failed:", err);
                        return message.reply("There was an issue analysing the image. Please try again later.");
                    }
                }

                if (!reply) {
                    console.log(`Model used: ${model}, Location: ${message.guild.name} - ${message.channel.name}, Prompt: ${prompt}`);
                    reply = await openai.chat.completions.create({
                        model,
                        messages: [
                            { role: 'user', content: finalPrompt }
                        ],
                        temperature: 1.0
                    });
                    reply = reply.choices[0].message.content;
                    console.log(`AI response: ${reply}`);
                }

                if (reply.length > 2000) {
                    reply = reply.slice(0, 1997) + '...';
                }
                if (reply) await message.reply(reply);
            }
        } catch (error) {
            console.error(error);
            message.reply('An error occurred while sending the message.');
        }
    },
};