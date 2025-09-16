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

client.once("ready", () => {
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
        apiOverloadReplies[
          Math.floor(Math.random() * apiOverloadReplies.length)
        ];
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
    <style>
      :root {
        --primary-color: #38bdf8;
        --secondary-color: #a855f7;
        --accent-color: #22c55e;
        --bg-gradient: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        --card-bg: rgba(255, 255, 255, 0.08);
        --text-color: #e2e8f0;
        --muted-text: #cbd5e1;
      }
      body {
        margin: 0;
        min-height: 100vh;
        background: var(--bg-gradient);
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: "Inter", sans-serif;
        color: var(--text-color);
        overflow-x: hidden;
      }
      .card {
        background: var(--card-bg);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 24px;
        padding: 2.5rem 3.5rem;
        text-align: center;
        max-width: 420px;
        width: 90%;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
        animation: fadeIn 0.8s ease, cardGlow 10s infinite alternate ease-in-out;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
      }
      .card:hover {
        transform: translateY(-5px);
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(30px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      @keyframes cardGlow {
        0% {
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4),
            0 0 20px var(--secondary-color), 0 0 40px var(--secondary-color);
          border-color: rgba(168, 85, 247, 0.8);
        }
        50% {
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4),
            0 0 25px var(--primary-color), 0 0 50px var(--primary-color);
          border-color: rgba(56, 189, 248, 1);
        }
        100% {
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4),
            0 0 22px var(--accent-color), 0 0 45px var(--accent-color);
          border-color: rgba(59, 130, 246, 0.9);
        }
      }
      .bot-name {
        font-size: 2.2rem;
        font-weight: 700;
        margin-bottom: 0.5em;
        background: linear-gradient(
          45deg,
          var(--primary-color),
          var(--secondary-color)
        );
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      .desc {
        font-size: 1.1rem;
        color: var(--muted-text);
        margin-bottom: 1.8em;
        line-height: 1.6;
      }
      .status-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75em;
        margin-bottom: 1.5em;
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
      .status-label {
        font-size: 1.1rem;
        font-weight: 500;
        color: var(--text-color);
      }
      .status-chip {
        display: inline-block;
        padding: 0.125rem 0.5rem;
        border-radius: 999px;
        background: rgba(56, 189, 248, 0.15);
        border: 1px solid rgba(56, 189, 248, 0.35);
        font-weight: 600;
        font-size: 0.95em;
      }
      .health {
        display: inline-block;
        padding: 0.125rem 0.5rem;
        border-radius: 999px;
        border: 1px solid transparent;
        font-weight: 600;
        font-size: 0.95em;
      }
      .health--excellent {
        color: #16a34a;
        background: rgba(22, 163, 74, 0.15);
        border-color: rgba(22, 163, 74, 0.3);
      }
      .health--good {
        color: #22c55e;
        background: rgba(34, 197, 94, 0.15);
        border-color: rgba(34, 197, 94, 0.3);
      }
      @media (prefers-reduced-motion: reduce) {
        .card {
          animation: none;
        }
        .status-dot::after {
          animation: none;
        }
        * {
          transition: none !important;
        }
      }
      .footer {
        font-size: 0.9rem;
        color: #94a3b8;
        margin-top: 1.2em;
      }
      @media (max-width: 600px) {
        .card {
          padding: 2rem 2.5rem;
          max-width: 90%;
        }
        .bot-name {
          font-size: 1.8rem;
        }
        .desc {
          font-size: 1rem;
        }
        .status-label {
          font-size: 1rem;
        }
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="bot-name">TARS <span style="font-size: 1.2em">🤖</span></div>
      <div class="desc">
        Your AI-powered Discord companion is online and ready to assist with
        style and efficiency.
      </div>
      <div class="status-row" role="status" aria-live="polite">
        <span class="status-dot" aria-hidden="true"></span>
        <span class="status-label">
          Status: <span id="status-text" class="status-chip">Online</span>
          • Health:
          <span id="health-text" class="health health--excellent"
            >Excellent</span
          >
        </span>
      </div>
      <div class="footer">Last checked: <span id="timestamp"></span></div>
    </div>
    <script>
      function updateTimestamp() {
        document.getElementById("timestamp").textContent =
          new Date().toLocaleString();
      }
      updateTimestamp();
      setInterval(updateTimestamp, 60000);

      let statusIndex = 0;
      const statusStates = ["Online", "Processing", "Online"];
      const healthStates = [
        { text: "Excellent", cls: "health--excellent" },
        { text: "Good", cls: "health--good" },
        { text: "Excellent", cls: "health--excellent" },
      ];
      const statusEl = document.getElementById("status-text");
      const healthEl = document.getElementById("health-text");
      function updateStatus() {
        statusEl.textContent = statusStates[statusIndex];
        const h = healthStates[statusIndex];
        healthEl.textContent = h.text;
        healthEl.className = 'health ' + h.cls;
        statusIndex = (statusIndex + 1) % statusStates.length;
      }
      setInterval(updateStatus, 10000);
    </script>
  </body>
</html>

  `);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}.`);
});

client.login(process.env.DISCORD_BOT_TOKEN);
