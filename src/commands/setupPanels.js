const { PermissionFlagsBits, ChannelType } = require('discord.js');
const { buildSupportPanel } = require('../panels/supportPanel');
const { buildRoleRequestPanel } = require('../panels/roleRequestPanel');
const { getGuildConfig } = require('../utils/guildConfig');

module.exports = {
  data: {
    name: 'setup-panels',
    description: 'Post ticket panels into a channel',
    options: [
      {
        name: 'channel',
        description: 'Channel to post the panels into',
        type: 7, // ApplicationCommandOptionType.Channel
        required: true,
      },
      {
        name: 'type',
        description: 'Which panel(s) to send',
        type: 3, // ApplicationCommandOptionType.String
        required: true,
        choices: [
          { name: 'Support', value: 'support' },
          { name: 'Role Requests', value: 'roles' },
          { name: 'Both', value: 'both' },
        ],
      },
    ],
    default_member_permissions: String(PermissionFlagsBits.ManageGuild),
    dm_permission: false,
  },

  // execute(interaction) will be hooked from interactionCreate later
  async execute(interaction) {
    const target = interaction.options.getChannel('channel');
    const which = interaction.options.getString('type');
    const config = getGuildConfig(interaction.guild.id);

    if (!target || target.type !== ChannelType.GuildText) {
      await interaction.reply({ content: 'Please choose a text channel.', ephemeral: true });
      return;
    }

    const toSend = [];
    if (which === 'both') {
      toSend.push(buildSupportPanel(config));
      toSend.push(buildRoleRequestPanel(config));
    } else if (which === 'support') {
      toSend.push(buildSupportPanel(config));
    } else if (which === 'roles') {
      toSend.push(buildRoleRequestPanel(config));
    }

    for (const payload of toSend) {
      await target.send(payload);
    }

    const label = which === 'both' ? 'Support and Role Request' : which === 'support' ? 'Support' : 'Role Request';
    await interaction.reply({ content: `${label} panel(s) posted in ${target}.`, ephemeral: true });
  },
};
