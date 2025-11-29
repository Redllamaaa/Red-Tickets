const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function buildSupportPanel() {
  const embed = new EmbedBuilder()
    .setTitle('Support Tickets')
    .setDescription('Need help? Open a private support ticket. A team member will assist you shortly.')
    .setColor(0x2f3136);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_open_support')
      .setLabel('Open Support Ticket')
      .setEmoji('🎫')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

module.exports = { buildSupportPanel };
