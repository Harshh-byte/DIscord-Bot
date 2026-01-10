import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import fetch from "node-fetch";
import { GoogleGenAI } from "@google/genai";
import { tarsSystemPrompt } from "./config.js";
import express from "express";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.once("clientReady", () => {
    console.log(`${client.user.username} online`);
    client.user.setPresence({
        activities: [{ name: "the server gossip", type: 2 }],
        status: "online",
    });
});

const userConversations = new Map();
const userVibes = new Map();
const userCalmCounts = new Map();
const userProfiles = new Map();
const cooldowns = new Map();

function getConversation(userId) {
    if (!userConversations.has(userId)) {
        userConversations.set(userId, [
            { role: "system", content: tarsSystemPrompt },
        ]);
    }
    return userConversations.get(userId);
}

function detectVibeScore(text) {
    const lower = text.toLowerCase();
    let score = 0;

    if (/[!]{2,}/.test(text)) score += 1;
    if (/(fuck|shit|bc|mc|madarchod|chutiya|bsdk)/.test(lower)) score += 3;
    if (/(idiot|stupid|dumb|loser)/.test(lower)) score += 2;

    if (/(lol|lmao|😂|🤣|😏|👀)/.test(text)) score += 1;
    if (/(bro|bhai|yaar|thanks|pls)/.test(lower)) score -= 1;

    return score;
}

function vibeFromScore(score) {
    if (score >= 3) return "toxic";
    if (score >= 1) return "poke";
    return "normal";
}

function decayVibe(vibe) {
    if (vibe === "toxic") return "poke";
    if (vibe === "poke") return "normal";
    return "normal";
}

function isHelpRequest(text) {
    return /\b(how|why|what|help|explain|fix|error|issue)\b/i.test(text);
}

function isRoastBattle(message) {
    return (
        /\broast\b/i.test(message.content) &&
        message.mentions.users.size >= 2
    );
}

function updateUserProfile(userId, vibeScore) {
    const profile = userProfiles.get(userId) || {
        interactions: 0,
        avgVibeScore: 0,
    };

    profile.interactions++;
    profile.avgVibeScore =
        (profile.avgVibeScore * (profile.interactions - 1) + vibeScore) /
        profile.interactions;

    userProfiles.set(userId, profile);
}

async function isDirectToBot(message) {
    if (message.mentions.has(client.user)) return true;
    if (message.reference?.messageId) {
        const original = await message.fetchReference();
        return original?.author?.id === client.user.id;
    }
    return false;
}

async function getGif(query) {
    try {
        const res = await fetch(
            `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(
                query
            )}&key=${process.env.TENOR_API_KEY}&limit=1&random=true`
        );
        const data = await res.json();
        return data.results?.[0]?.url || null;
    } catch {
        return null;
    }
}

async function generateContent(history) {
    const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: history,
    });
    return res.text;
}

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!(await isDirectToBot(message))) return;

    if (message.content === "!reset") {
        userConversations.delete(message.author.id);
        userProfiles.delete(message.author.id);
        userVibes.delete(message.author.id);
        userCalmCounts.delete(message.author.id);
        return message.reply("🧹 Fresh brain. New start.");
    }

    const lastUsed = cooldowns.get(message.author.id);
    if (lastUsed && Date.now() - lastUsed < 5000) {
        return message.reply("⏳ Slow down, champ.");
    }
    cooldowns.set(message.author.id, Date.now());

    message.channel.sendTyping();

    const vibeScore = detectVibeScore(message.content);
    const detectedVibe = vibeFromScore(vibeScore);
    updateUserProfile(message.author.id, vibeScore);

    const prevVibe = userVibes.get(message.author.id) || "normal";

    if (detectedVibe === "normal") {
        const calm = (userCalmCounts.get(message.author.id) || 0) + 1;
        userCalmCounts.set(message.author.id, calm);
        if (calm >= 2) {
            userVibes.set(message.author.id, decayVibe(prevVibe));
            userCalmCounts.set(message.author.id, 0);
        }
    } else {
        userVibes.set(message.author.id, detectedVibe);
        userCalmCounts.set(message.author.id, 0);
    }

    const currentVibe = userVibes.get(message.author.id) || "normal";
    const profile = userProfiles.get(message.author.id);

    const conversation = getConversation(message.author.id);

    if (isRoastBattle(message)) {
        const target = message.mentions.users.filter(
            (u) => u.id !== client.user.id
        ).first();

        conversation.push({
            role: "system",
            content: `Roast battle mode. Target ${target.username}. Be clever, playful, non-toxic. One roast only.`,
        });
    } else if (isHelpRequest(message.content)) {
        conversation.push({
            role: "system",
            content: `User is asking for genuine help. Be helpful first, witty second. Do not roast.`,
        });
    } else {
        conversation.push({
            role: "system",
            content: `
User vibe: ${currentVibe}.
User history: avg vibe ${profile.avgVibeScore.toFixed(2)} over ${profile.interactions} interactions.
If roasting, reference their last message directly. Avoid generic insults.
`,
        });
    }

    conversation.push({ role: "user", content: message.content });

    try {
        let text = await generateContent(
            conversation.map((c) => `${c.role}: ${c.content}`).join("\n")
        );

        const gifMatch = text.match(/\[(.*?) gif\]/i);
        let gifUrl = null;
        if (gifMatch) {
            gifUrl = await getGif(gifMatch[1]);
            text = text.replace(gifMatch[0], "").trim();
        }

        conversation.push({ role: "assistant", content: text });

        if (conversation.length > 12) {
            conversation.splice(1, conversation.length - 12);
        }

        await message.reply(text);
        if (gifUrl) await message.channel.send(gifUrl);
    } catch (err) {
        console.error(err);
        await message.reply("⚠️ Brain lag. Try again.");
    }
});

const app = express();
app.get("/", (_, res) => res.send("TARS online"));
app.listen(process.env.PORT || 3000);

client.login(process.env.DISCORD_BOT_TOKEN);
