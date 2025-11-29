const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function buildRoleRequestPanel() {
  const embed = new EmbedBuilder()
    .setTitle('ImperialRP Role Requests')
    .setDescription("This channel will be used to request roles that you can't auto-assign yourself, Please create a ticket and follow the format and a XO+ will be with you soon. ")
    .setColor(0x5865f2);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_open_role_request')
      .setLabel('Request a Role')
      .setEmoji('📝')
      .setStyle(ButtonStyle.Success)
  );

  return { embeds: [embed], components: [row] };
}

module.exports = { buildRoleRequestPanel };
