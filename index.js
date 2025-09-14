import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import fetch from "node-fetch";
import { GoogleGenAI } from "@google/genai";
import { finnSystemPrompt } from "./config.js";

// Initialize Gemini
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
});

let conversation = [{ role: "system", content: finnSystemPrompt }];
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
  "💨 Finn is on a coffee break. Come back in a couple!",
  "🚧 Roadblock ahead, but we’ll be cruising shortly. Try again!",
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
    conversation = [{ role: "system", content: finnSystemPrompt }];
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
      await message.reply(
        "Sorry, I had an error processing your request. Please try again later."
      );
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
