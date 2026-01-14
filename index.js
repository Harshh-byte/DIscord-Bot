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

async function generateContent(contents) {
  const res = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents,
    generationConfig: {
      maxOutputTokens: 50,
      temperature: 0.9,
    },
  });
  return res.text;
}

/* ---------------- Discord ---------------- */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("clientReady", () => {
  console.log("⚡ 🤖 TARS Online ⚡");
  client.user.setPresence({
    activities: [{ name: "the server gossip", type: ActivityType.Listening }],
    status: "online",
  });
});

/* ---------------- Memory ---------------- */
const conversations = new Map();
const cooldowns = new Map();

function getConversation(userId) {
  if (!conversations.has(userId)) {
    conversations.set(userId, { messages: [], rage: 0 });
  }
  return conversations.get(userId);
}

/* ---------------- Helpers ---------------- */
async function isDirectToBot(message) {
  if (message.mentions.has(client.user)) return true;

  if (message.reference?.messageId) {
    try {
      const original = await message.fetchReference();
      return original?.author?.id === client.user.id;
    } catch {
      return false;
    }
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

/* ---------------- Message Handler ---------------- */
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!(await isDirectToBot(message))) return;

  const lastUsed = cooldowns.get(message.author.id);
  if (lastUsed && Date.now() - lastUsed < 8000) return;
  cooldowns.set(message.author.id, Date.now());

  message.channel.sendTyping();

  const convo = getConversation(message.author.id);

  if (/fuck|madarchod|chutiya|bitch|bc/i.test(message.content)) {
    convo.rage++;
  }

  convo.messages.push({
    role: "user",
    content: message.content.trim(),
  });

  if (convo.messages.length > 5) {
    convo.messages.splice(0, convo.messages.length - 5);
  }

  try {
    const contents = [
      { role: "system", content: tarsSystemPrompt },
      {
        role: "system",
        content: `Current rage level: ${convo.rage}/3`,
      },
      ...convo.messages,
    ];

    let text = await generateContent(contents);

    const gifMatch = text.match(/\[(.*?) gif\]/i);
    let gifUrl = null;

    if (gifMatch) {
      gifUrl = await getGif(gifMatch[1]);
      text = text.replace(gifMatch[0], "").trim();
    }

    convo.messages.push({
      role: "assistant",
      content: text,
    });

    await message.reply(text);
    if (gifUrl) await message.channel.send(gifUrl);
  } catch (err) {
    console.error(err);
    await message.reply("🧠 Overheated. Try again later.");
  }
});

/* ---------------- Express Status Page ---------------- */
const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TARS | Bot Status</title>
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap"
      rel="stylesheet"
    />
    <link
      rel="icon"
      type="image/png"
      href="https://img.icons8.com/color/48/grok--v2.png"
    />
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      html,
      body {
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
      }
      body {
        min-height: 100vh;
        min-width: 100vw;
      }
      .glow-card {
        box-shadow: 0 0 32px 8px #22c55e44, 0 2px 16px 0 #000a;
      }
    </style>
  </head>
  <body
    class="relative flex items-center justify-center h-screen w-screen overflow-hidden"
  >
    <div
      class="absolute inset-0 -z-10 animate-gradient bg-gradient-to-br from-[#10141c] via-[#232b3a] to-[#3b82f6] opacity-100"
    ></div>
    <main
      class="w-full max-w-lg mx-auto rounded-2xl glow-card bg-[#232b3a] p-6 sm:p-10 flex flex-col items-center justify-center border border-[#2e374d] shadow-2xl"
      style="box-shadow: 0 0 32px 8px #22c55e44, 0 2px 16px 0 #000a"
    >
      <div class="flex items-center gap-3 mb-6">
        <span
          class="text-4xl font-extrabold text-[#5b7fff] tracking-wide drop-shadow-lg animate-pulse"
          >TARS</span
        >
        <span
          style="font-size: 2em"
          class="h-11 w-11 text-[#5b7fff] drop-shadow-lg animate-bounce"
          >🤖</span
        >
      </div>
      <p class="text-center text-lg text-gray-200 mb-8 font-medium">
        Your AI-powered Discord companion is
        <span class="text-[#5b7fff] font-bold">online</span> and ready to assist
        with <span class="text-green-400 font-bold">style</span> and
        <span class="text-pink-400 font-bold">efficiency</span>.
      </p>
      <div
        class="flex flex-col lg:flex-row items-center lg:items-center gap-4 lg:gap-8 mb-6 w-full justify-center"
      >
        <span class="flex items-center gap-2 lg:gap-3 lg:items-center">
          <span id="statusDot" class="status-dot"></span>
          <span class="status-label">Status:</span>
          <span id="status" class="status-chip">Online</span>
        </span>
        <span class="flex items-center gap-2 lg:gap-3 lg:items-center">
          <span class="status-label">Health:</span>
          <span id="health" class="health">Excellent</span>
        </span>
      </div>
      <span id="lastChecked" class="text-sm text-[#94a3b8] mb-2"
        >Last checked: <span id="lastCheckedTime">--</span></span
      >
      <span class="text-xs text-[#94a3b8] mt-4"
        >© 2025 TARS . All rights reserved.</span
      >
    </main>
    <script>
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      function updateStatus() {
        const statusEl = document.getElementById("status");
        const healthEl = document.getElementById("health");
        const lastCheckedEl = document.getElementById("lastCheckedTime");
        const statusDot = document.getElementById("statusDot");
        const isOnline = Math.random() > 0.1;
        statusEl.textContent = isOnline ? "Online" : "Processing";
        statusEl.className = isOnline
          ? "status-chip"
          : "status-chip bg-red-400 border-red-400 text-[#181f2a]";
        healthEl.textContent = isOnline ? "Excellent" : "Poor";
        healthEl.className = isOnline
          ? "health bg-green-400 border-green-400 text-[#181f2a]"
          : "health bg-yellow-400 border-yellow-400 text-[#181f2a]";
        if (statusEl.textContent === "Online") {
          statusDot.style.setProperty("--accent-color", "#22c55e");
          statusDot.style.setProperty(
            "--accent-shadow",
            "rgba(34,197,94,0.15)"
          );
          statusDot.className = "status-dot";
        } else {
          statusDot.style.setProperty("--accent-color", "#ef4444");
          statusDot.style.setProperty(
            "--accent-shadow",
            "rgba(239,68,68,0.15)"
          );
          statusDot.className = "status-dot";
        }
        const now = new Date();
        lastCheckedEl.textContent = now.toLocaleString();
      }
      updateStatus();
      setInterval(updateStatus, 10000);
    </script>
    <style>
      .status-label {
        font-size: 1.1rem;
        font-weight: 500;
        color: #e0e7ef;
      }
      .status-chip {
        display: inline-block;
        padding: 0.125rem 0.5rem;
        border-radius: 999px;
        background: rgba(56, 189, 248, 0.15);
        border: 1px solid rgba(56, 189, 248, 0.35);
        font-weight: 600;
        font-size: 0.95em;
        color: #e2e8f0;
        transition: background 0.2s, border 0.2s, color 0.2s;
      }
      .health {
        display: inline-block;
        padding: 0.125rem 0.5rem;
        border-radius: 999px;
        border: 1px solid transparent;
        font-weight: 600;
        font-size: 0.95em;
        color: #181f2a;
        transition: background 0.2s, border 0.2s, color 0.2s;
      }
      @keyframes gradient {
        0% {
          background-position: 0% 50%;
          filter: brightness(1.05);
        }
        25% {
          background-position: 50% 100%;
          filter: brightness(1.15);
        }
        50% {
          background-position: 100% 50%;
          filter: brightness(1.05);
        }
        75% {
          background-position: 50% 0%;
          filter: brightness(1.15);
        }
        100% {
          background-position: 0% 50%;
          filter: brightness(1.05);
        }
      }
      .animate-gradient {
        background-size: 200% 200%;
        animation: gradient 6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      }
      .status-dot {
        position: relative;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--accent-color);
        box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.15),
          0 0 10px var(--accent-color);
        flex: 0 0 auto;
        transition: background 0.2s;
      }
      .status-dot::after {
        content: "";
        position: absolute;
        top: 50%;
        left: 50%;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: var(--accent-color);
        transform: translate(-50%, -50%) scale(1);
        opacity: 0.6;
        pointer-events: none;
        animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
      }
      @keyframes ping {
        0% {
          transform: translate(-50%, -50%) scale(1);
          opacity: 0.6;
        }
        70% {
          transform: translate(-50%, -50%) scale(2.2);
          opacity: 0;
        }
        100% {
          opacity: 0;
        }
      }
      @media (max-width: 640px) {
        main {
          max-width: 95vw !important;
          padding: 1.25rem !important;
        }
      }
    </style>
  </body>
</html>
`);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

/* ---------------- Login ---------------- */
client.login(process.env.DISCORD_BOT_TOKEN);
