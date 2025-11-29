require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

const token = process.env.DISCORD_TOKEN;
if (!token) {
  logger.error('Missing DISCORD_TOKEN. Set it in your .env file.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
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
      logger.warn(`Skipping invalid command module: ${file}`);
      continue;
    }
    commands.set(mod.data.name, mod);
  }
}

// Load events
const readyHandler = require('./events/ready');
const interactionHandler = require('./events/interactionCreate');

client.once('ready', async () => {
  await readyHandler(client, token, Array.from(commands.values()));
});

client.on('interactionCreate', async (interaction) => {
  await interactionHandler(interaction, commands);
});

// Diagnostics and shutdown handling
client.on('error', (err) => logger.error('Client error', {}, err));
client.on('warn', (info) => logger.warn(`Client warn: ${info}`));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {}, reason instanceof Error ? reason : new Error(String(reason)));
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', {}, err);
});

const shutdown = (signal) => {
  logger.warn(`Received ${signal}. Shutting down...`);
  client.destroy();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

client.login(token);
