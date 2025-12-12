const { EmbedBuilder, MessageFlags } = require('discord.js');
const logger = require('./logger');
const { sendTicketClosureLogging } = require('./ticketLoggings');

function parseColor(val) {
  if (typeof val === 'string') {
    if (val.startsWith('#')) return parseInt(val.slice(1), 16);
    return parseInt(val, 16);
  }
  return val;
}

async function closeTicket(interaction, channel, config) {
  try {
    // Determine ticket type from channel name (more robust detection)
    const ticketName = channel.name || '';

    // Patterns for role tickets
    const rolePatterns = [
      /^role-/i,           // role-123
      /^role(?:request|req|_request|request-)/i, // rolerequest, role_request etc.
      /role-request/i,
      /^role\b/i,          // role123 or role-something
    ];

    if (rolePatterns.some((rx) => rx.test(ticketName))) {
      ticketType = 'role';
    }


    // -------------------------------
    // 🔎 FIND ORIGINAL TICKET USER
    // -------------------------------
    let ticketUser = null;

    if (channel.permissionOverwrites && channel.permissionOverwrites.cache) {
      for (const [id, overwrite] of channel.permissionOverwrites.cache) {
        const isMemberType = overwrite.type === 1 || overwrite.type === 'member';

        if (isMemberType && overwrite.allow.has('ViewChannel')) {
          try {
            ticketUser = await interaction.client.users.fetch(id);
            break;
          } catch {
            // Ignore fetch errors (user deleted, etc.)
          }
        }
      }
    }

    // Fallback — if no ticket owner found, assume the closer
    if (!ticketUser) {
      ticketUser = interaction.user;
    }

    // -------------------------------
    // 📢 SEND CLOSURE Logging
    // -------------------------------
    await sendTicketClosureLogging({
      user: ticketUser,
      ticketName,
      ticketType,
      closedBy: interaction.user,
      guild: interaction.guild,
      config,
    }).catch(err => logger.warn('Failed to send ticket closure Logging', err));

    // -------------------------------
    // ✉️ SEND DM TO USER
    // -------------------------------
    try {
      const dmDesc =
        config.ticketClosureDmEmbed?.description || 'Your ticket has been closed.';

      const dmEmbed = new EmbedBuilder()
        .setTitle(config.ticketClosureDmEmbed?.title || 'Ticket Closed')
        .setDescription(dmDesc)
        .setColor(parseColor(config.ticketClosureDmEmbed?.embedColor || '#FF0000'))
        .setTimestamp();

      // Timestamps
      const createdAt = channel.createdAt
        ? Math.floor(channel.createdAt.getTime() / 1000)
        : null;
      const closedAt = Math.floor(Date.now() / 1000);

      // Add fields if configured
      if (config.ticketClosureDmEmbed?.fields &&
          Array.isArray(config.ticketClosureDmEmbed.fields)) {

        config.ticketClosureDmEmbed.fields.forEach(field => {
          let value = field.value
            .replace('{ticketName}', channel.name)
            .replace('{closedBy}', `<@${interaction.user.id}>`);

          // Replace timestamps
          if (value.includes('{createdAt}') && createdAt) {
            value = value.replace('{createdAt}', `<t:${createdAt}:f>`);
          }
          if (value.includes('{closedAt}')) {
            value = value.replace('{closedAt}', `<t:${closedAt}:f>`);
          }

          dmEmbed.addFields({
            name: field.name,
            value,
            inline: field.inline ?? false
          });
        });
      }

      // Send DM
      await ticketUser.send({ embeds: [dmEmbed] }).catch((err) => {
        logger.warn(
          'Failed to send DM to user about ticket closure',
          { userId: ticketUser?.id, channelId: channel?.id },
          err
        );
      });
    } catch (dmErr) {
      logger.warn('Could not send DM to user', { userId: ticketUser?.id }, dmErr);
    }

    // -------------------------------
    // 🔒 HANDLE CHANNEL / THREAD CLOSURE
    // -------------------------------
    if (channel.isThread && channel.isThread()) {
      await channel.setLocked(true, `Ticket closed by ${interaction.user.tag}`);
      await channel.setArchived(true, `Ticket closed by ${interaction.user.tag}`);
    } else {
      const userDisplay =
        interaction.user?.toString() || interaction.user?.tag || 'A user';

      const delay = Number.isFinite(Number(config.deletionDelaySeconds))
        ? Number(config.deletionDelaySeconds)
        : 5;

      const deletionEmbed = buildDeletionEmbed(userDisplay, delay, config);

      await channel.send({ embeds: [deletionEmbed] }).catch((err) => {
        logger.warn(
          'Failed to send deletion embed',
          { channelId: channel?.id, userId: interaction.user?.id },
          err
        );
      });

      setTimeout(async () => {
        try {
          await channel.delete(`Ticket closed by ${interaction.user.tag}`);
        } catch (err) {
          logger.error(
            'Failed to delete ticket channel after delay',
            { channelId: channel?.id, userId: interaction.user?.id },
            err
          );
        }
      }, delay * 1000);
    }
  } catch (e) {
    logger.error(
      'Failed to close ticket',
      { channelId: channel?.id, userId: interaction.user?.id },
      e
    );
    throw e;
  }
}

function buildDeletionEmbed(userDisplay, delaySeconds, config) {
  const descTemplate = config.deletionEmbed?.description || '';
  const desc = descTemplate
    .replace('{user}', userDisplay)
    .replace('{delay}', String(delaySeconds));

  const color = config.deletionEmbed
    ? parseColor(config.deletionEmbed.embedColor)
    : undefined;

  const e = new EmbedBuilder()
    .setTitle(config.deletionEmbed?.title)
    .setDescription(desc);

  if (color !== undefined) e.setColor(color);

  return e;
}

module.exports = {
  closeTicket,
  buildDeletionEmbed,
};
