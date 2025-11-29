const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { supportTicketEmbed, panelImageUrl } = require('../config');

function buildSupportPanel() {
  const embed = new EmbedBuilder()
    .setTitle(supportTicketEmbed.title)
    .setDescription(supportTicketEmbed.panelDescription)
    .setColor(supportTicketEmbed.embedColor);

    if (panelImageUrl) {
    embed.setThumbnail(panelImageUrl);
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:open:support:v1')
      .setLabel('Open Support Ticket')
      .setEmoji('📩')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

module.exports = { buildSupportPanel };
