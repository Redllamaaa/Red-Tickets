const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuildConfig, updateGuildConfig } = require('../utils/guildConfig');

module.exports = {
  data: {
    name: 'config',
    description: 'Configure bot settings for this server',
    options: [
      {
        name: 'view',
        description: 'View current configuration',
        type: 1, // SUB_COMMAND
      },
      {
        name: 'set',
        description: 'Set a configuration value',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'setting',
            description: 'Which setting to configure',
            type: 3, // STRING
            required: true,
            choices: [
              { name: 'Support Role', value: 'supportRoleId' },
              { name: 'Support Ticket Category', value: 'supportTicketCategoryId' },
              { name: 'Role Request Category', value: 'roleTicketCategoryId' },
              { name: 'Logging Channel', value: 'loggingChannelId' },
              { name: 'Panel Image URL', value: 'panelImageUrl' },
            ],
          },
          {
            name: 'value',
            description: 'The value to set (use channel/role ID or URL)',
            type: 3, // STRING
            required: true,
          },
        ],
      },
      {
        name: 'reset',
        description: 'Reset configuration to defaults',
        type: 1, // SUB_COMMAND
      },
    ],
    default_member_permissions: String(PermissionFlagsBits.ManageGuild),
    dm_permission: false,
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'view') {
      const config = getGuildConfig(guildId);
      
      const embed = new EmbedBuilder()
        .setTitle('🔧 Server Configuration')
        .setColor('#0099ff')
        .addFields(
          { 
            name: 'Support Role', 
            value: config.supportRoleId ? `<@&${config.supportRoleId}>` : '❌ Not set',
            inline: true 
          },
          { 
            name: 'Support Category', 
            value: config.supportTicketCategoryId ? `<#${config.supportTicketCategoryId}>` : '❌ Not set',
            inline: true 
          },
          { 
            name: 'Role Request Category', 
            value: config.roleTicketCategoryId ? `<#${config.roleTicketCategoryId}>` : '❌ Not set',
            inline: true 
          },
          { 
            name: 'Logging Channel', 
            value: config.loggingChannelId ? `<#${config.loggingChannelId}>` : '❌ Not set',
            inline: true 
          },
          { 
            name: 'Panel Image', 
            value: config.panelImageUrl || '❌ Not set',
            inline: false 
          }
        )
        .setFooter({ text: 'Use /config set to change settings' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      
    } else if (subcommand === 'set') {
      const setting = interaction.options.getString('setting');
      const value = interaction.options.getString('value').trim();
      
      // Validate the value based on setting type
      let processedValue = value;
      
      if (setting === 'panelImageUrl') {
        // Allow empty string to clear, or must be valid URL
        if (value && !value.match(/^https?:\/\/.+/i)) {
          await interaction.reply({ 
            content: '❌ Panel image must be a valid HTTP/HTTPS URL, or empty to clear.', 
            ephemeral: true 
          });
          return;
        }
        processedValue = value || null;
      } else {
        // It's an ID field - extract ID from mention or use raw value
        const idMatch = value.match(/(\d{17,19})/);
        if (!idMatch) {
          await interaction.reply({ 
            content: '❌ Invalid ID format. Please provide a valid Discord ID or mention.', 
            ephemeral: true 
          });
          return;
        }
        processedValue = idMatch[1];
      }
      
      // Update the config
      const updates = { [setting]: processedValue };
      updateGuildConfig(guildId, updates);
      
      const settingNames = {
        supportRoleId: 'Support Role',
        supportTicketCategoryId: 'Support Ticket Category',
        roleTicketCategoryId: 'Role Request Category',
        loggingChannelId: 'Logging Channel',
        panelImageUrl: 'Panel Image URL',
      };
      
      await interaction.reply({ 
        content: `✅ **${settingNames[setting]}** has been updated!`, 
        ephemeral: true 
      });
      
    } else if (subcommand === 'reset') {
      // Reset by setting an empty object (will merge with defaults)
      updateGuildConfig(guildId, {});
      
      await interaction.reply({ 
        content: '✅ Configuration has been reset to defaults!', 
        ephemeral: true 
      });
    }
  },
};
