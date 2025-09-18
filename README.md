# TARS 🌌 - AI Discord Bot

TARS is a savage, witty Discord bot powered by Google's Gemini AI, designed to bring chaotic humor and intelligent conversation to your Discord server. With a personality inspired by the wit of Grok and the sass of a seasoned roaster, TARS delivers short, punchy responses that'll keep your server entertained.

## 🚀 Features

### 🤖 AI-Powered Conversations
- **Smart Responses**: Powered by Google Gemini 2.5 Flash for intelligent, context-aware replies
- **Personality**: Sarcastic, witty, and edgy responses with a touch of dark humor
- **Language Support**: Responds in English or Hinglish (Hindi + English mix) based on user input
- **Memory**: Maintains conversation context within sessions

### 🎯 Interactive Features
- **Mention Detection**: Responds when mentioned or replied to
- **GIF Integration**: Automatically fetches relevant GIFs from Tenor API
- **Emoji Reactions**: Can react to messages with appropriate emojis
- **Cooldown System**: 5-second cooldown per user to prevent spam

### 🌐 Web Dashboard
- **Status Page**: Beautiful web interface showing bot status and health
- **Real-time Updates**: Live status monitoring with animated indicators
- **Responsive Design**: Mobile-friendly interface with modern styling

### 🛠️ Bot Commands
- `!reset` - Clears conversation memory and starts fresh

## 📋 Prerequisites

Before setting up TARS, ensure you have:

- **Node.js** (v16 or higher)
- **Discord Bot Token** from Discord Developer Portal
- **Google Gemini API Key** from Google AI Studio
- **Tenor API Key** (optional, for GIF functionality)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Harshh-byte/DIscord-Bot.git
   cd DIscord-Bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   DISCORD_BOT_TOKEN=your_discord_bot_token_here
   GEMINI_API_KEY=your_google_gemini_api_key_here
   TENOR_API_KEY=your_tenor_api_key_here
   PORT=3000
   ```

## 🔑 Configuration Guide

### Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application and navigate to the "Bot" section
3. Copy the bot token and add it to your `.env` file
4. Enable the following **Privileged Gateway Intents**:
   - Message Content Intent
5. Invite the bot to your server with these permissions:
   - Send Messages
   - Read Message History
   - Add Reactions
   - Use External Emojis

### Google Gemini API Setup

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add the API key to your `.env` file as `GEMINI_API_KEY`

### Tenor API Setup (Optional)

1. Go to [Tenor API](https://tenor.com/developer/keyregistration)
2. Register for an API key
3. Add the API key to your `.env` file as `TENOR_API_KEY`

## 🚀 Running the Bot

### Development
```bash
npm start
```

### Production
```bash
node index.js
```

The bot will:
- Connect to Discord and show a startup message
- Start the web server on the specified port (default: 3000)
- Begin responding to mentions and replies

## 🌐 Web Dashboard

Access the bot's status dashboard at `http://localhost:3000` (or your deployed URL). The dashboard shows:

- **Real-time Status**: Online/Processing status with animated indicators
- **Health Monitoring**: Bot health metrics
- **Last Update Time**: When the status was last checked
- **Responsive Design**: Works on desktop and mobile devices

## 💬 How to Use

### Basic Interaction
- **Mention the bot**: `@TARS hello there!`
- **Reply to bot messages**: React to any of TARS's messages
- **Reset conversation**: Type `!reset` to clear conversation memory

### Response Style
TARS is designed to:
- Keep responses short (max 2 lines, under 25 words)
- Match your language style (English or Hinglish)
- Deliver witty, sarcastic, and edgy responses
- Use appropriate emojis sparingly
- Occasionally suggest GIFs for extra flavor

## 🚀 Deployment

### Railway
1. Fork this repository
2. Connect your Railway account to GitHub
3. Deploy the repository
4. Add environment variables in Railway dashboard
5. Your bot will be live!

### Heroku
1. Create a new Heroku app
2. Connect to your GitHub repository
3. Add environment variables in Settings > Config Vars
4. Deploy from the main branch

### VPS/Cloud Server
1. Clone the repository on your server
2. Install Node.js and npm
3. Set up environment variables
4. Use PM2 or similar process manager:
   ```bash
   npm install -g pm2
   pm2 start index.js --name "tars-bot"
   pm2 startup
   pm2 save
   ```

## 🛠️ Troubleshooting

### Common Issues

**Bot not responding to messages:**
- Ensure Message Content Intent is enabled in Discord Developer Portal
- Check that the bot has proper permissions in your server
- Verify the `DISCORD_BOT_TOKEN` is correct

**Gemini API errors:**
- Verify your `GEMINI_API_KEY` is valid and active
- Check Google AI Studio for API usage limits
- Ensure you have billing enabled if required

**GIFs not working:**
- Verify your `TENOR_API_KEY` is correct
- Check Tenor API usage limits

**Web dashboard not loading:**
- Ensure the PORT environment variable is set correctly
- Check if the port is available and not blocked by firewall

### Error Messages

The bot includes helpful error messages for common issues:
- **API Overload**: Shows when Gemini API is temporarily unavailable
- **Cooldown**: Informs users about the 5-second wait time
- **General Errors**: Provides user-friendly error messages

## 🔒 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_BOT_TOKEN` | ✅ | Your Discord bot token |
| `GEMINI_API_KEY` | ✅ | Google Gemini AI API key |
| `TENOR_API_KEY` | ❌ | Tenor API key for GIF functionality |
| `PORT` | ❌ | Port for web server (default: 3000) |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Follow the existing code style
- Test your changes thoroughly
- Update documentation if needed
- Keep the bot's personality consistent

## 📄 License

This project is licensed under the ISC License - see the package.json file for details.

## 🙏 Acknowledgments

- **Discord.js** - The powerful Discord API wrapper
- **Google Gemini AI** - For intelligent conversation capabilities
- **Tenor API** - For GIF integration
- **Express.js** - For the web dashboard

## 📞 Support

If you encounter any issues or have questions:
1. Check the [Issues](https://github.com/Harshh-byte/DIscord-Bot/issues) page
2. Create a new issue with detailed information
3. Join our Discord server for community support

---

Made with ❤️ by mad scientists in a secret lab 🧪✨

*Remember: TARS is designed to be a fun, sarcastic companion. Keep the vibes positive and the roasts clever!*