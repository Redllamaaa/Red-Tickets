const { ChannelType, PermissionFlagsBits, EmbedBuilder, ThreadAutoArchiveDuration, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { supportRoleId, ticketCategoryId } = require('../config');
const { buildRoleRequestModal } = require('../utils/roleRequestModal');
const { getNextTicketNumber } = require('../utils/db');
const logger = require('../utils/logger');

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

async function createTicketThread({ interaction, type, title, initialMessage, overrideName }) {
  try {
    if (ticketCategoryId) {
      const guild = interaction.guild;
      const parent = guild.channels.cache.get(ticketCategoryId) || await guild.channels.fetch(ticketCategoryId).catch(() => null);
      if (!parent) throw new Error('Configured ticketCategoryId not found.');
      if (parent.type !== ChannelType.GuildCategory) throw new Error('ticketCategoryId must be a category channel id.');

      const baseName = (overrideName || `${type}-${interaction.user.username}`)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .slice(0, 90);
      const channelName = baseName;
      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: parent.id,
        permissionOverwrites: [
          { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          ...(supportRoleId ? [{ id: supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
        ],
        reason: `Ticket created by ${interaction.user.tag}`,
      });

      const mention = supportRoleId ? `<@&${supportRoleId}>` : '';
      const content = `${mention} ${interaction.user} ${initialMessage || ''}`.trim();
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
      const msg = await channel.send({ content, embeds: [new EmbedBuilder().setTitle(title).setColor(0x2b2d31)], components: [row] });
      return { location: channel, message: msg };
    }

    const parentChannel = interaction.channel;
    if (!parentChannel || parentChannel.type !== ChannelType.GuildText) {
      throw new Error('Tickets must be created from a text channel or configure ticketCategoryId.');
    }

    const baseName = (overrideName || `${type}-${interaction.user.username}`)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .slice(0, 90);
    const threadName = baseName;
    const thread = await parentChannel.threads.create({
      name: threadName,
      type: ChannelType.PrivateThread,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
      reason: `Ticket created by ${interaction.user.tag}`,
      invitable: false,
    });

    await thread.members.add(interaction.user.id).catch(() => {});

    const mention = supportRoleId ? `<@&${supportRoleId}>` : '';
    const content = `${mention} ${interaction.user} ${initialMessage || ''}`.trim();
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
    const msg = await thread.send({ content, embeds: [new EmbedBuilder().setTitle(title).setColor(0x2b2d31)], components: [row] });
    return { location: thread, message: msg };
  } catch (err) {
    logger.error('Failed to create ticket', { userId: interaction.user?.id, guildId: interaction.guild?.id, context: 'createTicketThread' }, err);
    throw err;
  }
}

module.exports = async function onInteractionCreate(interaction, commands) {
  try {
    // Ensure we only operate in guild contexts
    if (!interaction.inGuild || !interaction.inGuild()) return;

    // Slash commands
    if (interaction.isChatInputCommand && interaction.isChatInputCommand()) {
      const cmd = commands.get(interaction.commandName);
      if (cmd) {
        await cmd.execute(interaction);
        return;
      }
    }

    // Buttons
    if (interaction.isButton && interaction.isButton()) {
      const { customId } = interaction;

      if (customId === 'ticket:open:support:v1') {
        if (!checkCooldown(interaction.user.id, 'open_support')) {
          return interaction.reply({ content: 'Please wait a few seconds before creating another ticket.', ephemeral: true }).catch(() => {});
        }
        await interaction.deferReply({ ephemeral: true });
        const { location } = await createTicketThread({
          interaction,
          type: 'support',
          title: 'Support Ticket',
          initialMessage: 'Please describe your issue in detail so we can assist you.',
        });
        await interaction.editReply({ content: `Created your support ticket: ${location}` });
        return;
      }

      if (customId === 'ticket:open:role_request:v1') {
        if (!checkCooldown(interaction.user.id, 'open_role')) {
          return interaction.reply({ content: 'Please wait a few seconds before creating another ticket.', ephemeral: true }).catch(() => {});
        }
        const modal = buildRoleRequestModal();
        await interaction.showModal(modal);
        return;
      }

      if (customId === 'ticket:close:v1') {
        await interaction.deferReply({ ephemeral: true });
        const ch = interaction.channel;
        try {
          if (ch.isThread && ch.isThread()) {
            await ch.setLocked(true, `Ticket closed by ${interaction.user.tag}`);
            await ch.setArchived(true, `Ticket closed by ${interaction.user.tag}`);
            await interaction.editReply({ content: 'Ticket archived and locked.' });
          } else {
            await interaction.editReply({ content: 'Closing ticket in 5 seconds...' });
            await ch.send(`Ticket closed by ${interaction.user}. Deleting this channel in 5 seconds...`).catch(() => {});
            setTimeout(async () => {
              try {
                await ch.delete(`Ticket closed by ${interaction.user.tag}`);
              } catch (err) {
                logger.error('Failed to delete ticket channel after delay', { channelId: ch?.id, userId: interaction.user?.id }, err);
              }
            }, 5000);
          }
        } catch (e) {
          logger.error('Failed to close ticket', { channelId: ch?.id, userId: interaction.user?.id }, e);
          await interaction.editReply({ content: 'Failed to close ticket. Check my permissions.' });
        }
        return;
      }

      if (customId === 'ticket:role:edit:v1') {
        const modal = buildRoleRequestModal();
        // encode the message id so we can update this message on submit
        try { modal.setCustomId(`role_request_modal:v1:${interaction.message.id}`); } catch {}
        await interaction.showModal(modal);
        return;
      }
    }

    // Modals
    if (interaction.isModalSubmit && interaction.isModalSubmit()) {
      const parts = interaction.customId.split(':');
      const baseId = parts[0];
      const version = parts[1];
      const targetMessageId = parts[2];
      if (baseId === 'role_request_modal' && version === 'v1') {
        await interaction.deferReply({ ephemeral: true });
        const ingameName = (interaction.fields.getTextInputValue('ingame_name') || '').trim();
        const steamid64 = (interaction.fields.getTextInputValue('steamid64') || '').trim();
        const battalion = (interaction.fields.getTextInputValue('battalion') || '').trim();
        const roles = (interaction.fields.getTextInputValue('roles') || '').trim();

        // very basic validation/sanitization
        const MAX_SHORT = 100;
        const MAX_ROLES = 500;
        const safe = (s, max) => s.replace(/[\n\r\t]/g, ' ').slice(0, max).trim();

        const vIngameName = safe(ingameName, MAX_SHORT);
        const vSteam = safe(steamid64, MAX_SHORT);
        const vBattalion = safe(battalion, MAX_SHORT);
        const vRoles = safe(roles, MAX_ROLES);

        // optional: simple steamid64 pattern
        const steamOk = /^\d{17}$/.test(vSteam);
        if (!steamOk) {
          await interaction.editReply({ content: 'SteamID64 must be a 17 digit number. Please try again.' });
          return;
        }

        // Determine ticket name for role requests
        const trimmedBattalion = (vBattalion || 'role').trim();
        const key = trimmedBattalion.toLowerCase();
        let nextNum = 1;
        try {
          nextNum = getNextTicketNumber(interaction.guild?.id || 'global', key);
        } catch (e) {
          logger.error('Failed to get next ticket number from DB', { guildId: interaction.guild?.id }, e);
        }
        const ticketName = `${trimmedBattalion}-${nextNum}`;

        const displayName = interaction.member?.displayName || interaction.user.username;
        const avatarUrl = interaction.user.displayAvatarURL?.({ size: 256 }) || interaction.user.displayAvatarURL?.();

        const headerEmbed = new EmbedBuilder()
          .setAuthor({ name: displayName, iconURL: avatarUrl })
          .setColor(0x5865f2)
          .setDescription(
            'Thank you for creating a Role Request. A Battalion XO+ will assign your roles shortly and will close the ticket when completed.\n\n' +
            'Please note this may take up to 24 Hours, so please be patient.'
          )
          .setTimestamp();

        const detailsEmbed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .addFields(
            { name: '**In-Game Name**', value: vIngameName || 'N/A', inline: false },
            { name: '**SteamID64**', value: vSteam || 'N/A', inline: false },
            { name: '**Battalion/Spec**', value: trimmedBattalion || 'N/A', inline: false },
            { name: '**Requested Roles**', value: vRoles || 'N/A', inline: false },
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
            await interaction.editReply({ content: 'Updated your role request.' });
          } else {
            await channel.send({ embeds: [headerEmbed, detailsEmbed] });
            await interaction.editReply({ content: 'Original message not found. Posted an update in this ticket.' });
          }
        } else {
          // Create a new ticket and set the details on the first message
          const { location, message } = await createTicketThread({
            interaction,
            type: 'role',
            title: 'Role Request Ticket',
            initialMessage: 'A new role request has been submitted.',
            overrideName: ticketName,
          });
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
      await interaction.followUp({ content: 'An error occurred while processing your request.', ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true }).catch(() => {});
    }
  }
};
