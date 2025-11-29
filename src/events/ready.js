const { ActivityType, REST, Routes, PermissionFlagsBits } = require('discord.js');
const { guildId } = require('../config');

// The commands will be loaded from the commands folder and passed in.
module.exports = async function onReady(client, token, commands) {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    client.user.setPresence({
      activities: [{ name: 'tickets', type: ActivityType.Listening }],
      status: 'online',
    });
  } catch (err) {
    console.warn('Failed to set presence:', err);
  }

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
      console.log(`Registered ${body.length} guild command(s) for ${guildId}.`);
    } else {
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body }
      );
      console.log(`Registered ${body.length} global command(s). It may take up to 1 hour to appear.`);
    }
  } catch (err) {
    console.error('Failed to register slash commands:', err);
  }
};
