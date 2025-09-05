import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { OpenAI } from "openai";
import fetch from "node-fetch";
import { auroraSystemPrompt } from "./config.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

let conversation = [{ role: "system", content: auroraSystemPrompt }];
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

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!(await isDirectToBot(message))) return;

  if (message.content.toLowerCase() === "!reset") {
    conversation = [{ role: "system", content: auroraSystemPrompt }];
    return message.reply("🧹 Memory wiped! Starting fresh ✨");
  }

  const cooldownTime = 5000;
  const lastUsed = cooldowns.get(message.author.id);

  if (lastUsed && Date.now() - lastUsed < cooldownTime) {
    const remaining = (
      (cooldownTime - (Date.now() - lastUsed)) /
      1000
    ).toFixed(1);
    return message.reply(
      `⏳ Chill! Wait **${remaining}s** before I can talk again.`
    );
  }

  cooldowns.set(message.author.id, Date.now());

  message.channel.sendTyping();

  conversation.push({
    role: "user",
    content: message.content,
  });

  try {
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: conversation,
      temperature: 0.8,
    });

    let text =
      chatCompletion.choices[0].message.content ||
      "Oops, my brain glitched 🤖💥 Try again?";

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
      } catch {}
    }
  } catch (err) {
    console.error("OpenAI API error:", err);

    const quotaReplies = [
      "⚡ I’m out of mana… give me a long rest before I can cast again!",
      "☕ My brain fuel ran out. Buy me a coffee and I’ll be back!",
      "🙃 Guess what? I talked too much and now I’m broke. See you later.",
      "😴 I’ve hit my word limit for today. Wake me up when the credits reset.",
      "🚫 Error 404: Brain juice not found. Try again tomorrow!",
    ];

    const glitchReplies = [
      "🤖 Oops, my brain glitched 🤯… wanna try again?",
      "⚡ System overload ⚠️… rebooting… try again?",
      "🧠 My brain blue-screened 💀… hit me with that again?",
      "🙃 Glitch mode activated 🤖✨… send it once more?",
      "🔄 Oops, brain.exe stopped working 😅… retry?",
    ];

    const spamReplies = [
      "🐢 Slow down, speed racer! I can’t keep up 😵",
      "🚦 Whoa there! One at a time, please 😅",
      "📵 Too many messages! Let me breathe for a sec 🫁",
      "🐇 You’re too fast! I’m more of a turtle bot 🐢",
      "💥 Spam overload detected! Rebooting systems…",
    ];

    if (err.code === "insufficient_quota") {
      const funnyReply =
        quotaReplies[Math.floor(Math.random() * quotaReplies.length)];
      await message.reply(funnyReply);
    } else if (err.status === 429) {
      const funnySpam =
        spamReplies[Math.floor(Math.random() * spamReplies.length)];
      await message.reply(funnySpam);
    } else {
      const funnyGlitch =
        glitchReplies[Math.floor(Math.random() * glitchReplies.length)];
      await message.reply(funnyGlitch);
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
