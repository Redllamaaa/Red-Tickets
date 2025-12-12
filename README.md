# Discord Ticket Bot

A feature-rich Discord bot for managing support tickets and role requests across multiple servers.

## 🌟 Features

- **Multi-Server Support** - Use the bot across multiple Discord servers with independent configurations
- **Two Ticket Types**
  - Support Tickets - For general help and support
  - Role Request Tickets - Custom form-based tickets for role assignments
- **Per-Server Configuration** - Each server can customize:
  - Support role
  - Ticket categories
  - Logging channels
  - Embed colors and messages
  - Panel images
- **Ticket Loggings** - Get notified in a dedicated channel when tickets are created/closed
- **User DMs** - Automatically DM users when their tickets are closed
- **Database Storage** - SQLite database for persistent ticket numbering and server configs
- **Cooldown Protection** - Prevents ticket spam

## 🚀 Quick Start

### Prerequisites

- Node.js 16.9.0 or higher
- A Discord bot token ([Create one here](https://discord.com/developers/applications))

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd discordbot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your bot token:
   ```
   DISCORD_TOKEN=your_bot_token_here
   ```

4. **Start the bot**
   ```bash
   npm start
   ```

### First-Time Server Setup

When you invite the bot to a server for the first time:

1. **Create Required Channels**
   - A category for support tickets
   - A category for role request tickets
   - A channel for ticket Loggings

2. **Configure the Bot**
   ```
   /config set setting:Support Role value:@YourSupportRole
   /config set setting:Support Ticket Category value:#support-category
   /config set setting:Role Request Category value:#roles-category
   /config set setting:Logging Channel value:#ticket-logs
   ```

3. **Deploy Ticket Panels**
   ```
   /setup-panels channel:#tickets type:Both
   ```

4. **Test It!**
   - Click a button on the panel to create a test ticket
   - Verify it creates in the correct category
   - Close it and verify you get a DM

## 📖 Documentation

- **[Multi-Server Setup Guide](MULTI_SERVER_SETUP.md)** - Complete setup instructions
- **[Migration Guide](MIGRATION_GUIDE.md)** - Upgrading from single-server to multi-server

## 🎮 Commands

| Command | Description | Permissions |
|---------|-------------|-------------|
| `/config view` | View current server configuration | Manage Guild |
| `/config set` | Update a configuration setting | Manage Guild |
| `/config reset` | Reset configuration to defaults | Manage Guild |
| `/setup-panels` | Post ticket panels in a channel | Manage Guild |

## 🎨 Customization

### Default Configuration

Each server starts with sensible defaults. You can customize:

- Embed titles, descriptions, and colors
- Initial messages in tickets
- Logging format
- Panel image
- Modal field labels

### Advanced Customization

For advanced customization beyond what `/config` offers, edit the defaults in:
```
src/utils/guildConfig.js
```

See the `DEFAULT_CONFIG` object.

## 🗄️ Database

The bot uses SQLite to store:
- Per-server configurations (`guild_configs` table)
- Ticket counters for numbering (`ticket_counters` table)

Database location: `data/RedTickets.db`

**Important:** Regularly backup this file!

## 📋 Permissions

The bot needs these permissions:

- View Channels
- Send Messages
- Manage Channels (to create ticket channels)
- Manage Roles (to set channel permissions)
- Read Message History
- Embed Links
- Attach Files

**Invite Link Template:**
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=268438544&scope=bot%20applications.commands
```

Replace `YOUR_CLIENT_ID` with your bot's client ID.

## 🔧 Troubleshooting

### Commands not showing up
- Global commands can take up to 1 hour to sync
- Try kicking and re-inviting the bot
- Ensure the bot has `applications.commands` scope

### Tickets not creating
- Verify categories are set with `/config view`
- Check bot has "Manage Channels" permission
- Ensure bot role is above the category in role hierarchy

### Database errors
- Ensure `data/` directory is writable
- Check file permissions on `data/RedTickets.db`
- Try deleting the database (will lose configs!)

### See more logs
Set `DEBUG=true` in your `.env` file

## 🏗️ Project Structure

```
discordbot/
├── src/
│   ├── commands/          # Slash commands
│   │   ├── config.js      # Configuration command
│   │   └── setupPanels.js # Panel deployment command
│   ├── events/            # Event handlers
│   │   ├── ready.js       # Bot startup
│   │   └── interactionCreate.js # Button/modal/command handling
│   ├── panels/            # Ticket panel builders
│   │   ├── supportPanel.js
│   │   └── roleRequestPanel.js
│   ├── utils/             # Utility modules
│   │   ├── db.js          # Database connection
│   │   ├── guildConfig.js # Per-server config management
│   │   ├── logger.js      # Logging utility
│   │   ├── roleRequestModal.js
│   │   ├── ticketClosure.js
│   │   └── ticketLoggings.js
│   ├── config.js          # Legacy config (now unused)
│   └── index.js           # Bot entry point
├── data/                  # Database files
│   └── RedTickets.db
├── .env                   # Environment variables
├── package.json
├── MULTI_SERVER_SETUP.md  # Setup guide
├── MIGRATION_GUIDE.md     # Migration instructions
└── README.md              # This file
```

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

See [LICENSE](LICENSE) file for details.

## 💬 Support

For issues or questions:
- Open an issue on GitHub
- Check existing documentation
- Review bot logs for error details

## 🎯 Roadmap

Potential future features:
- Web dashboard for configuration
- Ticket transcripts
- Auto-close inactive tickets
- Custom ticket fields per server
- Ticket templates
- Multi-language support

---

Made with ❤️ for Discord communities
