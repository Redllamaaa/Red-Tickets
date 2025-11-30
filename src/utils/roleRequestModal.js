// roleRequestModal.js
const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

function buildRoleRequestModal(defaults = {}) {
  return new ModalBuilder()
    .setCustomId('role_request_modal:v1')
    .setTitle('Role Request Form')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ingame_name')
          .setLabel('What is your In-Game Name?')
          .setPlaceholder('Nova PVT Red')
          .setRequired(true)
          .setValue(defaults.ingame_name || '')
          .setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('steamid64')
          .setLabel('What is your SteamID64?')
          .setPlaceholder('76561198894758216')
          .setRequired(true)
          .setValue(defaults.steamid64 || '')
          .setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('battalion')
          .setLabel('What battalion/Spec are you requesting for?')
          .setPlaceholder('Nova')
          .setRequired(true)
          .setValue(defaults.battalion || '')
          .setStyle(TextInputStyle.Short)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('roles')
          .setLabel('List all the roles you are requesting:')
          .setPlaceholder('Nova Trooper, Defence Regiment, Army Sector')
          .setRequired(true)
          .setValue(defaults.roles || '')
          .setStyle(TextInputStyle.Paragraph)
      )
    );
}

module.exports = { buildRoleRequestModal };
