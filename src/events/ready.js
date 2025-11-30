const { ActivityType, REST, Routes, PermissionFlagsBits } = require('discord.js');
const { guildId } = require('../config');
const logger = require('../utils/logger');

// The commands will be loaded from the commands folder and passed in.
module.exports = async function onclientReady(client, token, commands) {
  logger.info(`Logged in as ${client.user.tag}`, { userId: client.user.id });

  // Register slash commands
  try {
    const rest = new REST({ version: '10' }).setToken(token);
    const body = commands.map((c) => ({
      name: c.data.name,
      description: c.data.description,
      options: c.data.options,
      default_member_permissions: c.data.default_member_permissions,
      dm_permission: c.data.dm_permission ?? false,
    }));

    if (guildId) {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guildId),
        { body }
      );
      logger.info(`Registered ${body.length} guild command(s) for ${guildId}.`);
    } else {
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body }
      );
      logger.info(`Registered ${body.length} global command(s). It may take up to 1 hour to appear.`);
    }
  } catch (err) {
    logger.error('Failed to register slash commands', { context: 'clientReady' }, err);
  }
};
