const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function buildSupportPanel(config) {
  const embed = new EmbedBuilder()
    .setTitle(config.supportTicketEmbed.title)
    .setDescription(config.supportTicketEmbed.panelDescription)
    .setColor(config.supportTicketEmbed.embedColor);

    if (config.panelImageUrl) {
    embed.setThumbnail(config.panelImageUrl);
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
