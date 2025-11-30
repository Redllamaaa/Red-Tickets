const { EmbedBuilder } = require('discord.js');
const logger = require('./logger');
const { sendTicketClosureNotification } = require('./ticketNotifications');

/**
 * Parse color string/number for Discord embed.
 * Accepts '#FF0000', 'FF0000', or number.
 */
function parseColor(val) {
  if (typeof val === 'string') {
    return val.startsWith('#') ? parseInt(val.slice(1), 16) : parseInt(val, 16);
  }
  return val;
}

/**
 * Build deletion embed for the ticket channel.
 */
function buildDeletionEmbed(userDisplay, delaySeconds, config) {
  const descTemplate = config.deletionEmbed?.description || '';
  const desc = descTemplate
    .replace('{user}', userDisplay)
    .replace('{delay}', String(delaySeconds));

  const color = config.deletionEmbed?.embedColor
    ? parseColor(config.deletionEmbed.embedColor)
    : undefined;

  const embed = new EmbedBuilder()
    .setTitle(config.deletionEmbed?.title || '')
    .setDescription(desc);

  if (color) embed.setColor(color);

  return embed;
}

/**
 * Close a ticket: notify user, log, DM, delete or archive channel.
 */
async function closeTicket(interaction, channel, config) {
  try {

    const ticketName = channel.name || '';

    // -------------------------------
    // Find ticket owner
    // -------------------------------
    let ticketUser = interaction.user;

    if (channel.permissionOverwrites?.cache) {
      for (const [id, overwrite] of channel.permissionOverwrites.cache) {
        if (overwrite.type === 'member' && overwrite.allow.has('ViewChannel')) {
          try {
            ticketUser = await interaction.client.users.fetch(id);
            break;
          } catch {
            // Ignore fetch errors
          }
        }
      }
    }

    // -------------------------------
    // Send ticket closure notification
    // -------------------------------
    await sendTicketClosureNotification({
      user: ticketUser,
      ticketName,
      closedBy: interaction.user,
      guild: interaction.guild,
      config,
    }).catch(err => logger.warn('Failed to send ticket closure notification', err));

    // -------------------------------
    // Send DM to ticket user
    // -------------------------------
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle(config.ticketClosureDmEmbed?.title || 'Ticket Closed')
        .setDescription(config.ticketClosureDmEmbed?.description || 'Your ticket has been closed.')
        .setColor(parseColor(config.ticketClosureDmEmbed?.embedColor || '#FF0000'))
        .setTimestamp();

      const createdAt = channel.createdAt ? Math.floor(channel.createdAt.getTime() / 1000) : null;
      const closedAt = Math.floor(Date.now() / 1000);

      if (Array.isArray(config.ticketClosureDmEmbed?.fields)) {
        config.ticketClosureDmEmbed.fields.forEach(field => {
          let value = field.value
            .replace('{ticketName}', channel.name)
            .replace('{closedBy}', `<@${interaction.user.id}>`);

          if (createdAt) value = value.replace('{createdAt}', `<t:${createdAt}:f>`);
          value = value.replace('{closedAt}', `<t:${closedAt}:f>`);

          dmEmbed.addFields({ name: field.name, value, inline: field.inline ?? false });
        });
      }

      await ticketUser.send({ embeds: [dmEmbed] });
    } catch (err) {
      logger.warn('Failed to send DM to user', { userId: ticketUser?.id, channelId: channel?.id }, err);
    }

    // -------------------------------
    // Handle thread or channel closure
    // -------------------------------
    if (channel.isThread()) {
      await channel.setLocked(true, `Ticket closed by ${interaction.user.tag}`);
      await channel.setArchived(true, `Ticket closed by ${interaction.user.tag}`);
    } else {
      const userDisplay = interaction.user?.toString() || interaction.user?.tag || 'A user';
      const delay = Number.isFinite(Number(config.deletionDelaySeconds)) ? Number(config.deletionDelaySeconds) : 5;

      const deletionEmbed = buildDeletionEmbed(userDisplay, delay, config);

      await channel.send({ embeds: [deletionEmbed] }).catch(err =>
        logger.warn('Failed to send deletion embed', { channelId: channel?.id, userId: interaction.user?.id }, err)
      );

      setTimeout(async () => {
        try {
          await channel.delete(`Ticket closed by ${interaction.user.tag}`);
        } catch (err) {
          logger.error('Failed to delete ticket channel after delay', { channelId: channel?.id, userId: interaction.user?.id }, err);
        }
      }, delay * 1000);
    }
  } catch (err) {
    logger.error('Failed to close ticket', { channelId: channel?.id, userId: interaction.user?.id }, err);
    throw err;
  }
}

module.exports = {
  closeTicket,
  buildDeletionEmbed,
};
