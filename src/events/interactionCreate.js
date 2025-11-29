const { ChannelType, PermissionFlagsBits, EmbedBuilder, ThreadAutoArchiveDuration, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { supportRoleId, ticketCategoryId } = require('../config');
const { buildRoleRequestModal } = require('../utils/roleRequestModal');
const { getNextTicketNumber } = require('../utils/db');

async function createTicketThread({ interaction, type, title, initialMessage, overrideName }) {
  try {
    if (ticketCategoryId) {
      const guild = interaction.guild;
      const parent = guild.channels.cache.get(ticketCategoryId) || await guild.channels.fetch(ticketCategoryId).catch(() => null);
      if (!parent) throw new Error('Configured ticketCategoryId not found.');

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
      });

      const mention = supportRoleId ? `<@&${supportRoleId}>` : '';
      const content = `${mention} ${interaction.user} ${initialMessage || ''}`.trim();
      const actionComponents = [
        new ButtonBuilder()
          .setCustomId('ticket_close')
          .setLabel('Close')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger),
      ];
      if (type === 'role') {
        actionComponents.push(
          new ButtonBuilder()
            .setCustomId('ticket_role_edit')
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
        .setCustomId('ticket_close')
        .setLabel('Close')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger),
    ];
    if (type === 'role') {
      actionComponents.push(
        new ButtonBuilder()
          .setCustomId('ticket_role_edit')
          .setLabel('Edit Request')
          .setEmoji('✏️')
          .setStyle(ButtonStyle.Secondary)
      );
    }
    const row = new ActionRowBuilder().addComponents(...actionComponents);
    const msg = await thread.send({ content, embeds: [new EmbedBuilder().setTitle(title).setColor(0x2b2d31)], components: [row] });
    return { location: thread, message: msg };
  } catch (err) {
    console.error('Failed to create ticket:', err);
    throw err;
  }
}

module.exports = async function onInteractionCreate(interaction, commands) {
  try {
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
      if (customId === 'ticket_open_support') {
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

      if (customId === 'ticket_open_role_request') {
        const modal = buildRoleRequestModal();
        await interaction.showModal(modal);
        return;
      }

      if (customId === 'ticket_close') {
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
                console.error('Failed to delete ticket channel after delay:', err);
              }
            }, 5000);
          }
        } catch (e) {
          console.error('Failed to close ticket:', e);
          await interaction.editReply({ content: 'Failed to close ticket. Check my permissions.' });
        }
        return;
      }

      if (customId === 'ticket_role_edit') {
        const modal = buildRoleRequestModal();
        // encode the message id so we can update this message on submit
        try { modal.setCustomId(`role_request_modal:${interaction.message.id}`); } catch {}
        await interaction.showModal(modal);
        return;
      }
    }

    // Modals
    if (interaction.isModalSubmit && interaction.isModalSubmit()) {
      const [baseId, targetMessageId] = interaction.customId.split(':');
      if (baseId === 'role_request_modal') {
        await interaction.deferReply({ ephemeral: true });
        const ingameName = interaction.fields.getTextInputValue('ingame_name');
        const steamid64 = interaction.fields.getTextInputValue('steamid64');
        const battalion = interaction.fields.getTextInputValue('battalion');
        const roles = interaction.fields.getTextInputValue('roles');

        // Determine ticket name for role requests
        const trimmedBattalion = (battalion || 'role').trim();
        const key = trimmedBattalion.toLowerCase();
        let nextNum = 1;
        try {
          nextNum = getNextTicketNumber(interaction.guild?.id || 'global', key);
        } catch (e) {
          console.error('Failed to get next ticket number from DB:', e);
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
            { name: '**In-Game Name**', value: ingameName || 'N/A', inline: false },
            { name: '**SteamID64**', value: steamid64 || 'N/A', inline: false },
            { name: '**Battalion/Spec**', value: battalion || 'N/A', inline: false },
            { name: '**Requested Roles**', value: roles || 'N/A', inline: false },
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
    console.error('Interaction error:', err);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: 'An error occurred while processing your request.', ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true }).catch(() => {});
    }
  }
};
