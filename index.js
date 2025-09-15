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
  const startupMessages = [
    `🌌 ${client.user.username} awakened ✨`,
    `⚡ ${client.user.username} is online! 🔥`,
    `🤖 ${client.user.username} booted up 🚀`,
    `🔥 ${client.user.username} is ready to roll ⚡`,
    `✨ ${client.user.username} has entered the chat 💫`,
  ];
  const randomMsg =
    startupMessages[Math.floor(Math.random() * startupMessages.length)];
  console.log(randomMsg);

  client.user.setPresence({
    activities: [{ name: "the server gossip", type: 2 }],
    status: "online",
  });
});

let conversation = [{ role: "system", content: tarsSystemPrompt }];
const cooldowns = new Map();

async function isDirectToBot(message) {
  if (message.mentions.has(client.user)) return true;
  if (message.reference?.messageId) {
    const original = await message.fetchReference();
    if (original?.author?.id === client.user.id) return true;
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

const apiOverloadReplies = [
  "😵‍💫 Whoa, the server’s kinda fried right now. Try again in a bit!",
  "⌛ Patience, fam! The AI is catching its breath. Hit me up soon.",
  "🔥 The vibe’s too hot to handle. Chill for a sec and retry.",
  "💨 Tars is on a coffee break. Come back in a couple!",
  "🚧 Roadblock ahead, but we’ll be cruising shortly. Try again!",
];

const errorReplies = [
  "⚡ Oops, I tripped on some wires... give me a sec and try again! 🤖",
  "🎮 Bruh, I just lagged out... respawning soon. Try again in a bit! 🔄",
  "🤯 My brain just bluescreened... rebooting vibes, hit me up again!",
  "🚀 System overload detected. Running diagnostics... ping me again in a moment!",
  "🛠️ Error 404: My chill couldn’t be found. Let’s retry that!",
  "🔥 Too much spice in the circuit... retry before I overcook!",
];

async function generateContentWithRetry(
  historyString,
  retries = 3,
  delay = 1000
) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: historyString,
      });
      return response.text;
    } catch (err) {
      if (err.status === 503 && i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay * 2 ** i));
      } else {
        throw err;
      }
    }
  }
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!(await isDirectToBot(message))) return;

  if (message.content.toLowerCase() === "!reset") {
    conversation = [{ role: "system", content: tarsSystemPrompt }];
    return message.reply("🧹 Memory wiped! Starting fresh ✨");
  }

  const cooldownTime = 5000;
  const lastUsed = cooldowns.get(message.author.id);

  if (lastUsed && Date.now() - lastUsed < cooldownTime) {
    const remaining = ((cooldownTime - (Date.now() - lastUsed)) / 1000).toFixed(
      1
    );
    return message.reply(
      `⏳ Chill! Wait **${remaining}s** before I can talk again.`
    );
  }

  cooldowns.set(message.author.id, Date.now());
  message.channel.sendTyping();

  conversation.push({ role: "user", content: message.content });

  try {
    const historyString = conversation
      .map((c) => `${c.role}: ${c.content}`)
      .join("\n");
    let text = await generateContentWithRetry(historyString);

    text = text || "Oops, my brain glitched 🤖💥 Try again?";

    const reactionMatch = text.match(/:(\w+):/);
    let reaction = null;
    if (reactionMatch) {
      reaction = reactionMatch[0];
      text = text.replace(reactionMatch[0], "").trim();
    }

    const gifMatch = text.match(/\[(.*?) gif\]/i);
    let gifUrl = null;
    if (gifMatch) {
      gifUrl = await getGif(gifMatch[1]);
      text = text.replace(gifMatch[0], "").trim();
    }

    conversation.push({ role: "assistant", content: text });

    await message.reply(text);

    if (gifUrl) {
      await message.channel.send(gifUrl);
    }

    if (reaction) {
      try {
        await message.react(reaction.replace(/:/g, ""));
      } catch (error) {
        console.error("Failed to add reaction:", error);
      }
    }
  } catch (err) {
    console.error("Gemini API error:", err);
    if (err.status === 503) {
      const reply =
        apiOverloadReplies[Math.floor(Math.random() * apiOverloadReplies.length)];
      await message.reply(reply);
    } else {
      const reply =
        errorReplies[Math.floor(Math.random() * errorReplies.length)];
      await message.reply(reply);
    }
  }
});

const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>TARS | Bot Status</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
      <link rel="icon" type="image/png" href="https://img.icons8.com/color/48/grok--v2.png">
      <style>
        body {
          margin: 0;
          min-height: 100vh;
          background: #0f172a;
          display: flex;
          justify-content: center;
          align-items: center;
          font-family: 'Inter', sans-serif;
          color: #e2e8f0;
        }
        .card {
          background: rgba(255,255,255,0.06);
          backdrop-filter: blur(14px);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 20px;
          padding: 2.4rem 3.2rem;
          text-align: center;
          max-width: 380px;
          width: 90%;
          animation: fadeIn 0.7s ease, cardGlow 8s infinite alternate ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cardGlow {
          0% {
            box-shadow: 0 8px 28px rgba(0,0,0,0.3),
                        0 0 16px rgba(168,85,247,0.45),
                        0 0 28px rgba(168,85,247,0.25);
            border-color: rgba(168,85,247,0.7);
          }
          50% {
            box-shadow: 0 8px 28px rgba(0,0,0,0.3),
                        0 0 20px rgba(56,189,248,0.55),
                        0 0 36px rgba(56,189,248,0.3);
            border-color: rgba(56,189,248,0.9);
          }
          100% {
            box-shadow: 0 8px 28px rgba(0,0,0,0.3),
                        0 0 18px rgba(59,130,246,0.5),
                        0 0 32px rgba(59,130,246,0.3);
            border-color: rgba(59,130,246,0.85);
          }
        }
        .bot-name {
          font-size: 2rem;
          font-weight: 600;
          margin-bottom: 0.5em;
        }
        .desc {
          font-size: 1rem;
          color: #cbd5e1;
          margin-bottom: 1.5em;
          line-height: 1.5;
        }
        .status-row {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.2em;
        }
        .status-dot {
          position: relative;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 8px #22c55e99;
          margin-right: 0.6em;
        }
        .status-dot::after {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: #22c55e;
          transform: translate(-50%, -50%);
          opacity: 0.6;
          animation: pulse 1.6s ease-out infinite;
        }
        @keyframes pulse {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
          70% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
          100% { opacity: 0; }
        }
        .status-label {
          font-size: 1rem;
          font-weight: 500;
          color: #f1f5f9;
        }
        .footer {
          font-size: 0.85rem;
          color: #94a3b8;
          margin-top: 1em;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="bot-name">TARS <span style="font-size:1.2em;">🤖</span></div>
        <div class="desc">AI-powered Discord bot is live and vibing in style.</div>
        <div class="status-row">
          <span class="status-dot"></span>
          <span class="status-label">Online • <span style="color:#22c55e;font-weight:600">Healthy</span></span>
        </div>
        <div class="footer">Last updated: <span id="timestamp"></span></div>
      </div>
      <script>
        document.getElementById('timestamp').textContent = new Date().toLocaleString();
      </script>
    </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}.`);
});

client.login(process.env.DISCORD_BOT_TOKEN);
