import "dotenv/config";
import { Client, GatewayIntentBits, ActivityType } from "discord.js";
import fetch from "node-fetch";
import { GoogleGenAI } from "@google/genai";
import { tarsSystemPrompt } from "./config.js";
import express from "express";

/* ---------------- AI ---------------- */
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

/* ---------------- Discord ---------------- */
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.once("ready", () => {
    console.log(`${client.user.username} online`);

    client.user.setPresence({
        activities: [{ name: "the server gossip", type: ActivityType.Listening }],
        status: "online",
    });
});

/* ---------------- Memory ---------------- */
const userConversations = new Map();
const userVibes = new Map();
const userCalmCounts = new Map();
const userProfiles = new Map();
const cooldowns = new Map();

/* ---------------- Helpers ---------------- */
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
    return /\broast\b/i.test(message.content) && message.mentions.users.size >= 2;
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

async function generateContent(prompt) {
    const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
    });
    return res.text;
}

/* ---------------- Message Handler ---------------- */
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
        const target = message.mentions.users
            .filter((u) => u.id !== client.user.id)
            .first();

        conversation.push({
            role: "system",
            content: `Roast battle mode. Target ${target.username}. Be clever, playful, non-toxic. One roast only.`,
        });
    } else if (isHelpRequest(message.content)) {
        conversation.push({
            role: "system",
            content:
                "User is asking for genuine help. Be helpful first, witty second. Do not roast.",
        });
    } else {
        conversation.push({
            role: "system",
            content: `User vibe: ${currentVibe}. User history: avg vibe ${profile.avgVibeScore.toFixed(
                2
            )} over ${profile.interactions} interactions.`,
        });
    }

    conversation.push({ role: "user", content: message.content });

    try {
        const prompt = conversation
            .map((c) => `${c.role}: ${c.content}`)
            .join("\n");

        let text = await generateContent(prompt);

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

/* ---------------- Express Status Page ---------------- */
const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TARS | Bot Status</title>

  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet" />
  <link rel="icon" type="image/png" href="https://img.icons8.com/color/48/grok--v2.png" />
  <script src="https://cdn.tailwindcss.com"></script>

  <style>
    html, body {
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      font-family: 'Inter', sans-serif;
    }

    .glow-card {
      box-shadow: 0 0 32px 8px #22c55e44, 0 2px 16px 0 #000a;
    }

    @keyframes gradient {
      0%   { background-position: 0% 50%; filter: brightness(1.05); }
      25%  { background-position: 50% 100%; filter: brightness(1.15); }
      50%  { background-position: 100% 50%; filter: brightness(1.05); }
      75%  { background-position: 50% 0%; filter: brightness(1.15); }
      100% { background-position: 0% 50%; filter: brightness(1.05); }
    }

    .animate-gradient {
      background-size: 200% 200%;
      animation: gradient 6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }

    .status-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--accent-color);
      box-shadow: 0 0 0 4px rgba(34,197,94,0.15), 0 0 10px var(--accent-color);
      position: relative;
    }

    .status-dot::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: var(--accent-color);
      animation: ping 1.8s infinite;
      opacity: 0.6;
    }

    @keyframes ping {
      0%   { transform: scale(1); opacity: 0.6; }
      70%  { transform: scale(2.2); opacity: 0; }
      100% { opacity: 0; }
    }
  </style>
</head>

<body class="flex items-center justify-center h-screen w-screen relative">
  <div class="absolute inset-0 -z-10 animate-gradient bg-gradient-to-br from-[#10141c] via-[#232b3a] to-[#3b82f6]"></div>

  <main class="glow-card bg-[#232b3a] rounded-2xl p-8 max-w-lg w-full border border-[#2e374d] flex flex-col items-center text-center">
    <div class="flex items-center gap-3 mb-6">
      <span class="text-4xl font-extrabold text-[#5b7fff] animate-pulse">TARS</span>
      <span class="text-3xl animate-bounce">🤖</span>
    </div>

    <p class="text-gray-200 text-lg mb-8">
      Your AI-powered Discord companion is
      <span class="text-[#5b7fff] font-bold">online</span>
      and ready to assist with
      <span class="text-green-400 font-bold">style</span>
      and
      <span class="text-pink-400 font-bold">efficiency</span>.
    </p>

    <div class="flex gap-6 mb-6">
      <div class="flex items-center gap-2">
        <span id="statusDot" class="status-dot"></span>
        <span class="text-gray-200">Status:</span>
        <span id="status" class="text-blue-300 font-semibold">Online</span>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-gray-200">Health:</span>
        <span id="health" class="text-green-400 font-semibold">Excellent</span>
      </div>
    </div>

    <span class="text-sm text-gray-400 mb-2">
      Last checked: <span id="lastCheckedTime">--</span>
    </span>

    <span class="text-xs text-gray-500 mt-4">
      © 2025 TARS. All rights reserved.
    </span>
  </main>

  <script>
    function updateStatus() {
      const status = document.getElementById("status");
      const health = document.getElementById("health");
      const dot = document.getElementById("statusDot");
      const time = document.getElementById("lastCheckedTime");

      const online = Math.random() > 0.1;

      status.textContent = online ? "Online" : "Processing";
      health.textContent = online ? "Excellent" : "Poor";
      dot.style.setProperty("--accent-color", online ? "#22c55e" : "#ef4444");
      time.textContent = new Date().toLocaleString();
    }

    updateStatus();
    setInterval(updateStatus, 10000);
  </script>
</body>
</html>`);
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

/* ---------------- Login ---------------- */
client.login(process.env.DISCORD_BOT_TOKEN);
