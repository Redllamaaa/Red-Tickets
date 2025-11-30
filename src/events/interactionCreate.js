const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const config = require('../config');
const { buildRoleRequestModal } = require('../utils/roleRequestModal');
const { getNextTicketNumber } = require('../utils/db');
const { closeTicket } = require('../utils/ticketClosure');
const { sendTicketCreationNotification } = require('../utils/ticketNotifications');
const logger = require('../utils/logger');

const {
  supportRoleId,
  ticketCategoryId,
  roleRequestEmbed,
  supportTicketEmbed,
  MODAL_LABELS,
  deletionEmbed,
  supportInitialMessage,
  roleRequestInitialMessage,
  supportTicketCategoryId,
  roleTicketCategoryId
} = config;

// Simple in-memory cooldown
const cooldowns = new Map();
const COOLDOWN_MS = 5000;
function checkCooldown(userId, action) {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const last = cooldowns.get(key) || 0;
  if (now - last < COOLDOWN_MS) return false;
  cooldowns.set(key, now);
  return true;
}

// Parse color helper (hex string or number)
function parseColor(val) {
  if (typeof val === 'string') return val.startsWith('#') ? parseInt(val.slice(1), 16) : parseInt(val, 16);
  return val;
}

// Build deletion embed from config
function buildDeletionEmbed(userDisplay, delaySeconds) {
  const descTemplate = deletionEmbed?.description || '';
  const desc = descTemplate.replace('{user}', userDisplay).replace('{delay}', String(delaySeconds));
  const embed = new EmbedBuilder().setTitle(deletionEmbed?.title || '').setDescription(desc);
  if (deletionEmbed?.embedColor) embed.setColor(parseColor(deletionEmbed.embedColor));
  return embed;
}

/**
 * Create a ticket channel + initial message
 */
async function createTicketThread({ interaction, type, title, initialMessage, overrideName }) {
  try {
    // Determine category
    const categoryId = type === 'role'
      ? roleTicketCategoryId || ticketCategoryId
      : supportTicketCategoryId || ticketCategoryId;

    if (!categoryId) {
      await interaction.editReply({
        content: `${type === 'role' ? 'roleTicketCategoryId' : 'supportTicketCategoryId'} is not set in config.`
      }).catch(() => {});
      return null;
    }

    const guild = interaction.guild;
    const parent = guild.channels.cache.get(categoryId) || await guild.channels.fetch(categoryId).catch(() => null);
    if (!parent || parent.type !== ChannelType.GuildCategory) throw new Error('Configured category not found or not a category channel.');

    // Sanitize channel name
    const baseName = (overrideName || `${type}-${interaction.user.username}`)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .slice(0, 90);

    // Create channel
    const channel = await guild.channels.create({
      name: baseName,
      type: ChannelType.GuildText,
      parent: parent.id,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        ...(supportRoleId ? [{ id: supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : [])
      ],
      reason: `Ticket created by ${interaction.user.tag}`
    });

    // Format initial message
    const userMention = interaction.user?.toString() || interaction.user?.tag;
    const moderatorsMention = supportRoleId ? `<@&${supportRoleId}>` : 'moderators';
    const content = (initialMessage || '')
      .replace(/{user}/g, userMention)
      .replace(/{moderators}/g, moderatorsMention)
      .trim() || `${moderatorsMention} ${userMention}`;

    // Build embeds & buttons
    const embedConfig = type === 'role' ? roleRequestEmbed : supportTicketEmbed;
    const embedColor = parseColor(embedConfig?.embedColor);
    const headerEmbed = new EmbedBuilder()
      .setAuthor({ name: interaction.member?.displayName || interaction.user.username, iconURL: interaction.user.displayAvatarURL({ size: 256 }) })
      .setTitle(embedConfig?.title || title)
      .setDescription(embedConfig?.openDescription || '')
      .setColor(embedColor);

    const buttons = [
      new ButtonBuilder().setCustomId('ticket:close:v1').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger)
    ];
    if (type === 'role') buttons.push(new ButtonBuilder().setCustomId('ticket:role:edit:v1').setLabel('Edit Request').setEmoji('✏️').setStyle(ButtonStyle.Secondary));

    const row = new ActionRowBuilder().addComponents(...buttons);

    const msg = await channel.send({ content, embeds: [headerEmbed], components: [row] });
    return { channel, message: msg, ticketType: type, ticketUser: interaction.user };
  } catch (err) {
    logger.error('Failed to create ticket', { userId: interaction.user?.id, guildId: interaction.guild?.id }, err);
    throw err;
  }
}

/**
 * Main interaction handler
 */
module.exports = async function onInteractionCreate(interaction, commands) {
  try {
    if (!interaction.inGuild()) return;

    // Slash commands
    if (interaction.isChatInputCommand()) {
      const cmd = commands.get(interaction.commandName);
      if (cmd) return cmd.execute(interaction);
    }

    // Buttons
    if (interaction.isButton()) {
      const { customId } = interaction;

      // ----- Open Support Ticket -----
      if (customId === 'ticket:open:support:v1') {
        if (!checkCooldown(interaction.user.id, 'open_support')) {
          return interaction.reply({ content: 'Please wait a few seconds before creating another ticket.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let nextNum = 1;
        try { nextNum = getNextTicketNumber(interaction.guild?.id || 'global', 'support_ticket'); } catch (e) { logger.error('Failed to get next ticket number', { guildId: interaction.guild?.id }, e); }

        const ticketName = `support-#${nextNum}`;
        const result = await createTicketThread({ interaction, type: 'support', title: 'Support Ticket', initialMessage: supportInitialMessage, overrideName: ticketName });
        if (!result) return;

        await sendTicketCreationNotification({ user: result.ticketUser, channel: result.channel, ticketType: result.ticketType, client: interaction.client, config }).catch(err => logger.warn('Failed to send ticket creation notification', err));
        await interaction.editReply({ content: `Created your support ticket: ${result.channel}` });
        return;
      }

      // ----- Open Role Request Modal -----
      if (customId === 'ticket:open:role_request:v1') {
        if (!checkCooldown(interaction.user.id, 'open_role')) {
          return interaction.reply({ content: 'Please wait a few seconds before creating another ticket.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        return interaction.showModal(buildRoleRequestModal());
      }

      // ----- Close Ticket -----
      if (customId === 'ticket:close:v1') {
        await interaction.deferUpdate().catch(() => {});
        try { await closeTicket(interaction, interaction.channel, config); } catch (e) { logger.error('Failed to close ticket', { channelId: interaction.channel?.id, userId: interaction.user?.id }, e); }
        return;
      }

      // ----- Edit Role Request Ticket -----
      if (customId === 'ticket:role:edit:v1') {
        const embeds = interaction.message.embeds;
        const detailsEmbed = embeds.find(e => e.fields?.length > 0);
        const defaults = {};
        if (detailsEmbed?.fields) {
          detailsEmbed.fields.forEach(f => { defaults[f.name] = f.value; });
        }
        const modal = buildRoleRequestModal(defaults);
        modal.setCustomId(`role_request_modal:v1:${interaction.message.id}`);
        return interaction.showModal(modal);
      }
    }

    // Modals
    if (interaction.isModalSubmit()) {
      const [baseId, version, targetMessageId] = interaction.customId.split(':');
      if (baseId === 'role_request_modal' && version === 'v1') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Extract form values safely
        const safeInput = (id, max = 100) => (interaction.fields.getTextInputValue(id) || '').replace(/[\n\r\t]/g, ' ').slice(0, max).trim();
        const ingameName = safeInput('ingame_name');
        const steamid64 = safeInput('steamid64');
        const battalion = safeInput('battalion');
        const roles = safeInput('roles', 500);

        // Generate ticket name
        let nextNum = 1;
        try { nextNum = getNextTicketNumber(interaction.guild?.id || 'global', 'role_request'); } catch (e) { logger.error('Failed to get next ticket number', { guildId: interaction.guild?.id }, e); }
        const ticketName = `${battalion || 'role'}-#${nextNum}`;

        const headerEmbed = new EmbedBuilder()
          .setAuthor({ name: interaction.member?.displayName || interaction.user.username, iconURL: interaction.user.displayAvatarURL({ size: 256 }) })
          .setDescription(roleRequestEmbed.openDescription)
          .setColor(parseColor(roleRequestEmbed.embedColor));

        const detailsEmbed = new EmbedBuilder()
          .setColor(parseColor(roleRequestEmbed.embedColor))
          .addFields(
            { name: MODAL_LABELS.ingame_name, value: ingameName || 'N/A' },
            { name: MODAL_LABELS.steamid64, value: steamid64 || 'N/A' },
            { name: MODAL_LABELS.battalion, value: battalion || 'N/A' },
            { name: MODAL_LABELS.roles, value: roles || 'N/A' },
          );

        // Update existing message or create new ticket
        if (targetMessageId) {
          const target = await interaction.channel.messages.fetch(targetMessageId).catch(() => null);
          if (target) return target.edit({ embeds: [headerEmbed, detailsEmbed], components: target.components });
        }

        const result = await createTicketThread({ interaction, type: 'role', title: 'Role Request Ticket', initialMessage: roleRequestInitialMessage, overrideName: ticketName });
        if (!result) return;

        await sendTicketCreationNotification({ user: result.ticketUser, channel: result.channel, ticketType: result.ticketType, client: interaction.client, config }).catch(err => logger.warn('Failed to send ticket creation notification', err));
        await result.message.edit({ embeds: [headerEmbed, detailsEmbed] }).catch(() => result.channel.send({ embeds: [headerEmbed, detailsEmbed] }));
        await interaction.editReply({ content: `Submitted your role request: ${result.channel}` });
        return;
      }
    }
  } catch (err) {
    logger.error('Interaction error', { userId: interaction.user?.id, guildId: interaction.guild?.id }, err);
    const replyFn = interaction.deferred || interaction.replied ? interaction.followUp : interaction.reply;
    await replyFn.call(interaction, { content: 'An error occurred while processing your request.', flags: MessageFlags.Ephemeral }).catch(() => {});
  }
};
