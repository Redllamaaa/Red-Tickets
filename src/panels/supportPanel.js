const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function buildSupportPanel(config) {
  const embed = new EmbedBuilder()
    .setTitle(config.supportTicketEmbed.title)
    .setDescription(config.supportTicketEmbed.panelDescription)
    .setColor(config.supportTicketEmbed.embedColor);

  // Use panel-specific image if set, otherwise fall back to global panelImageUrl
  const imageUrl = config.supportTicketEmbed.imageUrl || config.panelImageUrl;
  if (imageUrl) {
    embed.setThumbnail(imageUrl);
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
