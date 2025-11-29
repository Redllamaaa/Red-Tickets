const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { roleRequestEmbed, panelImageUrl } = require('../config');

function buildRoleRequestPanel() {
  const embed = new EmbedBuilder()
    .setTitle(roleRequestEmbed.title)
    .setDescription(roleRequestEmbed.panelDescription)
    .setColor(roleRequestEmbed.embedColor);
    

  if (panelImageUrl) {
    embed.setThumbnail(panelImageUrl);
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
