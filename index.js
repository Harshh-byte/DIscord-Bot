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
  console.log(`🚀 Logged in as ${client.user.tag}`);
});

const conversations = new Map();

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

  message.channel.sendTyping();

  let conversation = conversations.get(message.channel.id);
  if (!conversation) {
    conversation = [
      {
        role: "system",
        content: auroraSystemPrompt,
      },
    ];
  }

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
      "Oops, my brain glitched. Try again?";

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
    conversations.set(message.channel.id, conversation);

    await message.reply(text);

    if (gifUrl) {
      await message.channel.send(gifUrl);
    }

    if (reaction) {
      try {
        await message.react(reaction.replace(/:/g, ""));
      } catch {
      }
    }
  } catch (err) {
    console.error("OpenAI API error:", err);
    await message.reply("Oops, my brain glitched. Try again?");
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);