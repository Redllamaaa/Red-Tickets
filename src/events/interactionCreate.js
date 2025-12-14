const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { getGuildConfig, updateGuildConfig } = require('../utils/guildConfig');
const { buildRoleRequestModal } = require('../utils/roleRequestModal');
const { getNextTicketNumber } = require('../utils/db');
const { closeTicket } = require('../utils/ticketClosure');
const { sendTicketCreationLogging } = require('../utils/ticketLoggings');
const logger = require('../utils/logger');
const { parseColor } = require('../utils/logger');

// simple in-memory cooldown to prevent spam
const cooldowns = new Map(); // key: `${userId}:${action}` -> timestamp ms
const COOLDOWN_MS = 5000;

function checkCooldown(userId, action) {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const last = cooldowns.get(key) || 0;
  if (now - last < COOLDOWN_MS) return false;
  cooldowns.set(key, now);
  return true;
}

async function createTicketThread({ interaction, type, title, initialMessage, overrideName, config }) {
  try {
    // choose category per ticket type, fall back to legacy ticketCategoryId
    const categoryId = (type === 'role' ? (config.roleTicketCategoryId || config.ticketCategoryId) : (config.supportTicketCategoryId || config.ticketCategoryId));
    if (!categoryId) {
      const which = type === 'role' ? 'roleTicketCategoryId' : 'supportTicketCategoryId';
      await interaction.editReply({ content: `${which} is not defined. Please set it in src/config.js.` }).catch(() => {});
      return null;
    }

    const guild = interaction.guild;
    const parent = guild.channels.cache.get(categoryId) || await guild.channels.fetch(categoryId).catch(() => null);
    if (!parent) throw new Error('Configured ticketCategoryId not found.');
    if (parent.type !== ChannelType.GuildCategory) throw new Error('ticketCategoryId must be a category channel id.');

    const baseName = (overrideName || `${type}-${interaction.user.username}`)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .slice(0, 90);
    const channelName = baseName;
    
    // Determine which support roles to use based on ticket type
    let supportRoleOverwrites = [];
    const supportRoleIds = type === 'role' ? config.roleRequestSupportRoleIds : (config.supportRoleId ? [config.supportRoleId] : []);
    
    if (supportRoleIds.length > 0) {
      const validRoleIds = [];
      
      for (const roleId of supportRoleIds) {
        if (guild.roles.cache.has(roleId)) {
          validRoleIds.push(roleId);
          supportRoleOverwrites.push({
            id: roleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          });
        } else {
          logger.warn('Support role no longer exists, removing from config', { guildId: guild.id, roleId });
        }
      }
      
      // Clean up deleted roles from config for role request support roles
      if (type === 'role' && validRoleIds.length !== supportRoleIds.length) {
        updateGuildConfig(guild.id, { roleRequestSupportRoleIds: validRoleIds });
      }
    }
    
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: parent.id,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        ...supportRoleOverwrites,
      ],
      reason: `Ticket created by ${interaction.user.tag}`,
    });

    // format initial message template with placeholders
    const formatInitialMessage = (template) => {
      const userMention = interaction.user?.toString() || interaction.user?.tag || 'A user';
      
      // Get valid support role mentions
      let roleMentions = '';
      if (type === 'role' && config.roleRequestSupportRoleIds?.length > 0) {
        roleMentions = config.roleRequestSupportRoleIds
          .filter(id => guild.roles.cache.has(id))
          .map(id => `<@&${id}>`)
          .join(' ');
      } else if (config.supportRoleId && guild.roles.cache.has(config.supportRoleId)) {
        roleMentions = `<@&${config.supportRoleId}>`;
      }
      
      const moderatorsMention = roleMentions || 'moderators';
      
      return (template || '')
        .replace(/{user}/g, userMention)
        .replace(/{moderators}/g, moderatorsMention)
        .trim();
    };

    const processedInitial = formatInitialMessage(initialMessage || '');
    const content = processedInitial || `${formatInitialMessage('')} ${interaction.user}`;

    const actionComponents = [
      new ButtonBuilder()
        .setCustomId('ticket:close:v1')
        .setLabel('Close')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger),
    ];
    if (type === 'role') {
      actionComponents.push(
        new ButtonBuilder()
          .setCustomId('ticket:role:edit:v1')
          .setLabel('Edit Request')
          .setEmoji('✏️')
          .setStyle(ButtonStyle.Secondary)
      );
    }
    const row = new ActionRowBuilder().addComponents(...actionComponents);
    const embedColor =
      type === 'role'
        ? parseColor(config.roleRequestEmbed.embedColor)
        : parseColor(config.supportTicketEmbed.embedColor);

    // Build header embed from config (configurable per ticket type)
    const displayName = interaction.member?.displayName || interaction.user.username;
    const avatarUrl = interaction.user.displayAvatarURL?.({ size: 256 }) || interaction.user.displayAvatarURL?.();
    const headerConfig = type === 'role' ? config.roleRequestEmbed : config.supportTicketEmbed;
    const headerEmbed = new EmbedBuilder()
      .setAuthor({ name: displayName, iconURL: avatarUrl })
      .setTitle(headerConfig?.title || title)
      .setDescription(headerConfig?.openDescription || '')
      .setColor(embedColor)

    const msg = await channel.send({
      content,
      embeds: [headerEmbed],
      components: [row],
    });
    return { location: channel, message: msg, ticketType: type, ticketUser: interaction.user };
  } catch (err) {
    logger.error('Failed to create ticket', { userId: interaction.user?.id, guildId: interaction.guild?.id, context: 'createTicketThread' }, err);
    throw err;
  }
}

// Build the deletion embed from config, replacing placeholders
function buildDeletionEmbed(userDisplay, delaySeconds, config) {
  const descTemplate = (config.deletionEmbed && config.deletionEmbed.description);
  const desc = descTemplate.replace('{user}', userDisplay).replace('{delay}', String(delaySeconds));
  const color = config.deletionEmbed ? parseColor(config.deletionEmbed.embedColor) : undefined;
  const e = new EmbedBuilder().setTitle(config.deletionEmbed?.title).setDescription(desc);
  if (color !== undefined) e.setColor(color);
  return e;
}

module.exports = async function onInteractionCreate(interaction, commands) {
  try {
    // Ensure we only operate in guild contexts
    if (!interaction.inGuild?.()) return;

    // Get guild-specific configuration
    const config = getGuildConfig(interaction.guild.id);

    // Slash commands
    if (interaction.isChatInputCommand?.()) {
      const cmd = commands.get(interaction.commandName);
      if (cmd) {
        await cmd.execute(interaction);
        return;
      }
    }

    // Buttons
    if (interaction.isButton?.()) {
      const { customId } = interaction;

      if (customId === 'ticket:open:support:v1') {
        if (!checkCooldown(interaction.user.id, 'open_support')) {
          return interaction.reply({ content: 'Please wait a few seconds before creating another ticket.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        // Generate numbered ticket name for support tickets
        const key = 'support_ticket'; // Use a global key for all support tickets
        let nextNum = 1;
        try {
          nextNum = getNextTicketNumber(interaction.guild?.id || 'global', key);
        } catch (e) {
          logger.error('Failed to get next ticket number from DB', { guildId: interaction.guild?.id }, e);
        }
        const ticketName = `support-#${nextNum}`;
        
        const result = await createTicketThread({
          interaction,
          type: 'support',
          title: 'Support Ticket',
          initialMessage: config.supportInitialMessage,
          overrideName: ticketName,
          config,
        });
        if (!result) return; // Exit if config error
        const { location, ticketType, ticketUser } = result;
        
        // Send Logging to ticket Logging channel
        await sendTicketCreationLogging({
          user: ticketUser,
          channel: location,
          ticketType,
          client: interaction.client,
          config,
        }).catch(err => logger.warn('Failed to send ticket creation Logging', err));
        
        await interaction.editReply({ content: `Created your support ticket: ${location}` });
        return;
      }

      if (customId === 'ticket:open:role_request:v1') {
        if (!checkCooldown(interaction.user.id, 'open_role')) {
          return interaction.reply({ content: 'Please wait a few seconds before creating another ticket.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        const modal = buildRoleRequestModal();
        await interaction.showModal(modal);
        return;
      }

      if (customId === 'ticket:close:v1') {
        // acknowledge the interaction silently to avoid "Interaction Failed"
        try { await interaction.deferUpdate().catch(() => {}); } catch {}
        const ch = interaction.channel;
        try {
          await closeTicket(interaction, ch, config);
        } catch (e) {
          logger.error('Failed to close ticket', { channelId: ch?.id, userId: interaction.user?.id }, e);
        }
        return;
      }

      if (customId === 'ticket:role:edit:v1') {
        const embeds = interaction.message.embeds;
        const details = embeds[1]; // second embed contains the form fields

        if (!details?.fields) {
          logger.warn('Could not find role request details in embed', { userId: interaction.user?.id, messageId: interaction.message.id });
          await interaction.reply({ 
            content: '❌ Could not load previous responses. The ticket message may be corrupted.', 
            flags: MessageFlags.Ephemeral 
          });
          return;
        }

        // Extract previous values safely, treating 'N/A' as empty
        const defaults = {
          ingame_name: (details.fields.find(f => f.name === config.MODAL_LABELS.ingame_name)?.value || '')?.replace(/^N\/A$/, '') || '',
          steamid64:   (details.fields.find(f => f.name === config.MODAL_LABELS.steamid64)?.value || '')?.replace(/^N\/A$/, '') || '',
          battalion:   (details.fields.find(f => f.name === config.MODAL_LABELS.battalion)?.value || '')?.replace(/^N\/A$/, '') || '',
          roles:       (details.fields.find(f => f.name === config.MODAL_LABELS.roles)?.value || '')?.replace(/^N\/A$/, '') || '',
        };

        // Build modal with pre-filled values
        const modal = buildRoleRequestModal(defaults);

        // encode the message id so we can update this exact message on submit
        try { modal.setCustomId(`role_request_modal:v1:${interaction.message.id}`); } catch {}

        await interaction.showModal(modal);
        return;
      }
    }

    // Modals
    if (interaction.isModalSubmit?.()) {
      const parts = interaction.customId.split(':');
      const baseId = parts[0];
      const version = parts[1];
      const targetMessageId = parts[2];
      
      // Handle config modal submissions
      if (baseId === 'config' && parts[1] === 'set') {
        const setting = parts.slice(2).join(':'); // Rejoin in case the setting has colons
        const description = interaction.fields.getTextInputValue('description');
        
        const [parent, child] = setting.split('.');
        const config = getGuildConfig(interaction.guild.id);
        const updates = {
          [parent]: {
            ...config[parent],
            [child]: description
          }
        };
        
        updateGuildConfig(interaction.guild.id, updates);
        
        const panelName = setting.startsWith('supportTicketEmbed') ? 'Support Panel' : 'Role Request Panel';
        await interaction.reply({
          content: `✅ **${panelName} - Description** has been updated!`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
      if (baseId === 'role_request_modal' && version === 'v1') {
        // Check if interaction is still valid before attempting to defer
        if (interaction.replied || interaction.deferred) {
          logger.warn('Attempted to handle already-responded modal interaction', { userId: interaction.user?.id });
          return;
        }
        
        // Defer reply immediately to prevent interaction timeout
        try {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        } catch (err) {
          logger.error('Failed to defer modal submit interaction', { 
            userId: interaction.user?.id,
            replied: interaction.replied,
            deferred: interaction.deferred,
            error: err.message 
          });
          return; // Can't proceed if we can't acknowledge the interaction
        }
        
        const ingameName = interaction.fields.getTextInputValue('ingame_name') || '';
        const steamid64 = interaction.fields.getTextInputValue('steamid64') || '';
        const battalion = interaction.fields.getTextInputValue('battalion') || '';
        const roles = interaction.fields.getTextInputValue('roles') || '';

        // very basic validation/sanitization
        const MAX_SHORT = 100;
        const MAX_ROLES = 500;
        const safe = (s, max) => s.replace(/[\n\r\t]/g, ' ').slice(0, max).trim();

        const vIngameName = safe(ingameName, MAX_SHORT);
        const vSteam = safe(steamid64, MAX_SHORT);
        const vBattalion = safe(battalion, MAX_SHORT);
        const vRoles = safe(roles, MAX_ROLES);

        // Determine ticket name for role requests
        const trimmedBattalion = (vBattalion || 'role').trim();
        const key = 'role_request'; // Use a global key for all role requests
        let nextNum = 1;
        try {
          nextNum = getNextTicketNumber(interaction.guild?.id || 'global', key);
        } catch (e) {
          logger.error('Failed to get next ticket number from DB', { guildId: interaction.guild?.id }, e);
        }
        const ticketName = `${trimmedBattalion}-#${nextNum}`;

        const displayName = interaction.member?.displayName || interaction.user.username;
        const avatarUrl = interaction.user.displayAvatarURL?.({ size: 256 }) || interaction.user.displayAvatarURL?.();

        const headerEmbed = new EmbedBuilder()
          .setAuthor({ name: displayName, iconURL: avatarUrl })
          .setColor(parseColor(config.roleRequestEmbed.embedColor))
          .setDescription(config.roleRequestEmbed.openDescription)

        const detailsEmbed = new EmbedBuilder()
          .setColor(parseColor(config.roleRequestEmbed.embedColor))
          .addFields(
            { name: config.MODAL_LABELS.ingame_name, value: ingameName || 'N/A', inline: false },
            { name: config.MODAL_LABELS.steamid64, value: steamid64 || 'N/A', inline: false },
            { name: config.MODAL_LABELS.battalion, value: battalion || 'N/A', inline: false },
            { name: config.MODAL_LABELS.roles, value: roles || 'N/A', inline: false },
          );

        if (targetMessageId) {
          // Update existing ticket message
          const channel = interaction.channel;
          const target = await channel.messages.fetch(targetMessageId).catch(() => null);
          if (target) {
            const existingFirst = target.embeds?.[0];
            const embedsPayload = [];
            if (existingFirst) embedsPayload.push(existingFirst);
            else embedsPayload.push(headerEmbed);
            embedsPayload.push(detailsEmbed);
            await target.edit({ embeds: embedsPayload, components: target.components });
            await interaction.editReply({ content: '✅ Role request updated successfully!' });
          } else {
            await channel.send({ embeds: [headerEmbed, detailsEmbed] });
            await interaction.editReply({ content: 'Original message not found. Posted an update in this ticket.' });
          }
        } else {
          // Create a new ticket and set the details on the first message
          const result = await createTicketThread({
            interaction,
            type: 'role',
            title: 'Role Request Ticket',
            initialMessage: config.roleRequestInitialMessage,
            overrideName: ticketName,
            config,
          });
          if (!result) return; // Exit if config error
          const { location, message, ticketType, ticketUser } = result;
          
          // Send Logging to ticket Logging channel
          await sendTicketCreationLogging({
            user: ticketUser,
            channel: location,
            ticketType,
            client: interaction.client,
            config,
          }).catch(err => logger.warn('Failed to send ticket creation Logging', err));
          
          await message.edit({ embeds: [headerEmbed, detailsEmbed] }).catch(async () => {
            await location.send({ embeds: [headerEmbed, detailsEmbed] });
          });
          await interaction.editReply({ content: `Submitted your role request: ${location}` });
        }
        return;
      }
    }
  } catch (err) {
    logger.error('Interaction error', { userId: interaction.user?.id, guildId: interaction.guild?.id, context: 'interactionCreate' }, err);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: 'An error occurred while processing your request.', flags: MessageFlags.Ephemeral }).catch(() => {});
    } else {
      await interaction.reply({ content: 'An error occurred while processing your request.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
};
