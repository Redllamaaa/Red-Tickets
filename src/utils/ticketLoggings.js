const { EmbedBuilder } = require('discord.js');
const logger = require('./logger');

function parseColor(val) {
  if (typeof val === 'string') {
    if (val.startsWith('#')) return parseInt(val.slice(1), 16);
    return parseInt(val, 16);
  }
  return val;
}

// Extract ticket number from names like "support-123"
function extractTicketNumberFromName(name) {
  const match = name.match(/-(\d+)$/);
  return match ? match[1] : null;
}

/**
 * Sends a ticket creation Logging to the configured Logging channel
 * @param {Object} options - Options for the Logging
 * @param {import('discord.js').User} options.user - The user who created the ticket
 * @param {import('discord.js').TextChannel} options.channel - The ticket channel
 * @param {string} options.ticketType - The type of ticket ('support' or 'role')
 * @param {import('discord.js').Client} options.client - Discord client
 * @param {Object} options.config - Bot configuration
 */
async function sendTicketCreationLogging({ user, channel, ticketType, client, config }) {
  try {
    if (!config.loggingChannelId) {
      return; // Loggings disabled
    }

    const guild = channel.guild;
    const LoggingChannel =
      guild.channels.cache.get(config.loggingChannelId) ||
      await guild.channels.fetch(config.loggingChannelId).catch(() => null);

    if (!LoggingChannel) {
      logger.warn('Ticket Logging channel not found', {
        channelId: config.loggingChannelId,
        guildId: guild.id
      });
      return;
    }

    const embedConfig = config.ticketCreationLoggingEmbed || {};
    const displayName = user.displayName || user.username;

    // Extract ticket number from channel name
    const ticketNum = extractTicketNumberFromName(channel.name);

    const description = (embedConfig.description || '')
      .replace('{user}', `<@${user.id}>`)
      .replace('{ticketName}', channel.name)
      .replace('{ticketType}', ticketType)
      .replace('{ticketChannel}', `<#${channel.id}>`)
      .replace('{ticketNumber}', ticketNum ?? 'N/A');

    const embed = new EmbedBuilder()
      .setTitle(embedConfig.title || 'New Ticket Created')
      .setDescription(description)
      .setColor(parseColor(embedConfig.embedColor))
      .setAuthor({ name: displayName, iconURL: user.displayAvatarURL({ size: 256 }) });

    // Add fields if configured
    if (embedConfig.fields && Array.isArray(embedConfig.fields)) {
      embedConfig.fields.forEach(field => {
        const value = field.value
          .replace('{ticketType}', ticketType)
          .replace('{ticketNumber}', ticketNum ?? 'N/A');
        embed.addFields({ name: field.name, value, inline: field.inline ?? false });
      });
    }

    await LoggingChannel.send({ embeds: [embed] });
  } catch (err) {
    logger.error('Failed to send ticket creation Logging', {
      channelId: channel?.id,
      userId: user?.id
    }, err);
  }
}

/**
 * Sends a ticket closure Logging to the configured Logging channel
 * @param {Object} options - Options for the Logging
 * @param {import('discord.js').User} options.user - The user who created the ticket
 * @param {string} options.ticketName - The name of the ticket channel
 * @param {string} options.ticketType - The type of ticket ('support' or 'role')
 * @param {import('discord.js').User} options.closedBy - The user who closed the ticket
 * @param {import('discord.js').Guild} options.guild - The guild
 * @param {Object} options.config - Bot configuration
 */
async function sendTicketClosureLogging({ user, ticketName, ticketType, closedBy, guild, config }) {
  try {
    if (!config.loggingChannelId) {
      return; // Loggings disabled
    }

    const LoggingChannel =
      guild.channels.cache.get(config.loggingChannelId) ||
      await guild.channels.fetch(config.loggingChannelId).catch(() => null);

    if (!LoggingChannel) {
      logger.warn('Ticket Logging channel not found', {
        channelId: config.loggingChannelId,
        guildId: guild.id
      });
      return;
    }

    const embedConfig = config.ticketClosureLoggingEmbed || {};
    const userDisplay = user.displayName || user.username;

    // Extract ticket number from ticketName
    const ticketNum = extractTicketNumberFromName(ticketName);

    const description = (embedConfig.description || '')
      .replace('{user}', `<@${user.id}>`)
      .replace('{ticketName}', ticketName)
      .replace('{ticketType}', ticketType)
      .replace('{closedBy}', `<@${closedBy.id}>`)
      .replace('{ticketNumber}', ticketNum ?? 'N/A');

    const embed = new EmbedBuilder()
      .setTitle(embedConfig.title || 'Ticket Closed')
      .setDescription(description)
      .setColor(parseColor(embedConfig.embedColor))
      .setAuthor({ name: userDisplay, iconURL: user.displayAvatarURL({ size: 256 }) });

    // Add fields if configured
    if (embedConfig.fields && Array.isArray(embedConfig.fields)) {
      embedConfig.fields.forEach(field => {
        const value = field.value
          .replace('{ticketType}', ticketType)
          .replace('{ticketNumber}', ticketNum ?? 'N/A');
        embed.addFields({ name: field.name, value, inline: field.inline ?? false });
      });
    }

    await LoggingChannel.send({ embeds: [embed] });
  } catch (err) {
    logger.error('Failed to send ticket closure Logging', {
      ticketName,
      userId: user?.id
    }, err);
  }
}

module.exports = {
  sendTicketCreationLogging,
  sendTicketClosureLogging,
};
