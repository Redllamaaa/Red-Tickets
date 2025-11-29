require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Missing DISCORD_TOKEN. Set it in your .env file.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Load commands
const commands = new Map();
const commandsDir = path.join(__dirname, 'commands');
if (fs.existsSync(commandsDir)) {
  for (const file of fs.readdirSync(commandsDir)) {
    if (!file.endsWith('.js')) continue;
    const mod = require(path.join(commandsDir, file));
    if (!mod?.data?.name || typeof mod.execute !== 'function') {
      console.warn(`Skipping invalid command module: ${file}`);
      continue;
    }
    commands.set(mod.data.name, mod);
  }
}

// Load events
const readyHandler = require('./events/ready');
const interactionHandler = require('./events/interactionCreate');

client.once('clientReady', async () => {
  await readyHandler(client, token, Array.from(commands.values()));
});

client.on('interactionCreate', async (interaction) => {
  await interactionHandler(interaction, commands);
});

// Diagnostics and shutdown handling
client.on('error', (err) => console.error('Client error:', err));
client.on('warn', (info) => console.warn('Client warn:', info));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

const shutdown = (signal) => {
  console.log(`Received ${signal}. Shutting down...`);
  client.destroy();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

client.login(token);
