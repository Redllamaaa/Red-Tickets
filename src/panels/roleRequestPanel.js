const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function buildRoleRequestPanel(config) {
  const embed = new EmbedBuilder()
    .setTitle(config.roleRequestEmbed.title)
    .setDescription(config.roleRequestEmbed.panelDescription)
    .setColor(config.roleRequestEmbed.embedColor);

  // Use panel-specific image if set, otherwise fall back to global panelImageUrl
  const imageUrl = config.roleRequestEmbed.imageUrl || config.panelImageUrl;
  if (imageUrl) {
    embed.setThumbnail(imageUrl);
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:open:role_request:v1')
      .setLabel('Request a Role')
      .setEmoji('📝')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

module.exports = { buildRoleRequestPanel };
