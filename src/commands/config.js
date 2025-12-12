const { PermissionFlagsBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const { getGuildConfig, updateGuildConfig, DEFAULT_CONFIG } = require('../utils/guildConfig');

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
              { name: 'Panel Image URL (Global)', value: 'panelImageUrl' },
              { name: 'Support Panel - Title', value: 'supportTicketEmbed.title' },
              { name: 'Support Panel - Description', value: 'supportTicketEmbed.panelDescription' },
              { name: 'Support Panel - Image URL', value: 'supportTicketEmbed.imageUrl' },
              { name: 'Role Request Panel - Title', value: 'roleRequestEmbed.title' },
              { name: 'Role Request Panel - Description', value: 'roleRequestEmbed.panelDescription' },
              { name: 'Role Request Panel - Image URL', value: 'roleRequestEmbed.imageUrl' },
            ],
          },
          {
            name: 'value',
            description: 'The value to set (use channel/role ID or URL)',
            type: 3, // STRING
            required: false,
          },
        ],
      },
      {
        name: 'reset',
        description: 'Reset configuration to defaults',
        type: 1, // SUB_COMMAND
      },
      {
        name: 'reset-embeds',
        description: 'Reset panel embed text/colors to defaults (keeps IDs)',
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
            value: config.supportTicketCategoryId ? `\`${config.supportTicketCategoryId}\`` : '❌ Not set',
            inline: true 
          },
          { 
            name: 'Role Request Category', 
            value: config.roleTicketCategoryId ? `\`${config.roleTicketCategoryId}\`` : '❌ Not set',
            inline: true 
          },
          { 
            name: 'Logging Channel', 
            value: config.loggingChannelId ? `<#${config.loggingChannelId}>` : '❌ Not set',
            inline: true 
          },
          { 
            name: 'Panel Image (Global)', 
            value: config.panelImageUrl || '❌ Not set',
            inline: false 
          },
          {
            name: '📩 Support Panel',
            value: `**Title:** ${config.supportTicketEmbed.title}\n**Image:** ${config.supportTicketEmbed.imageUrl || 'Using global'}\n**Description:** ${config.supportTicketEmbed.panelDescription.substring(0, 100)}${config.supportTicketEmbed.panelDescription.length > 100 ? '...' : ''}`,
            inline: false
          },
          {
            name: '📝 Role Request Panel',
            value: `**Title:** ${config.roleRequestEmbed.title}\n**Image:** ${config.roleRequestEmbed.imageUrl || 'Using global'}\n**Description:** ${config.roleRequestEmbed.panelDescription.substring(0, 100)}${config.roleRequestEmbed.panelDescription.length > 100 ? '...' : ''}`,
            inline: false
          }
        )
        .setFooter({ text: 'Use /config set to change settings' });

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      
    } else if (subcommand === 'set') {
      const setting = interaction.options.getString('setting');
      const value = interaction.options.getString('value');
      
      // Determine if this is an image URL, text field, or ID field
      const isImageUrl = setting.includes('imageUrl') || setting === 'panelImageUrl';
      const isTextField = setting.includes('.title') || setting.includes('.panelDescription');
      
      // For multi-line descriptions, show a modal instead
      if (setting.includes('.panelDescription')) {
        const config = getGuildConfig(guildId);
        const isSupport = setting.startsWith('supportTicketEmbed');
        const currentValue = isSupport ? config.supportTicketEmbed.panelDescription : config.roleRequestEmbed.panelDescription;
        
        const modal = new ModalBuilder()
          .setCustomId(`config:set:${setting}`)
          .setTitle(isSupport ? 'Support Panel Description' : 'Role Request Panel Description');
        
        const textInput = new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Panel Description')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(currentValue)
          .setRequired(true)
          .setMaxLength(1024);
        
        modal.addComponents(new ActionRowBuilder().addComponents(textInput));
        
        await interaction.showModal(modal);
        return;
      }
      
      // For other settings, value is required
      if (!value) {
        await interaction.reply({
          content: '❌ Please provide a value for this setting.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
      // Validate the value based on setting type
      let processedValue = value.trim();
      
      if (isImageUrl) {
        // Allow empty string to clear, or must be valid URL
        if (value && !value.match(/^https?:\/\/.+/i)) {
          await interaction.reply({ 
            content: '❌ Image URL must be a valid HTTP/HTTPS URL, or empty to clear.', 
            flags: MessageFlags.Ephemeral 
          });
          return;
        }
        processedValue = value || null;
      } else if (isTextField) {
        // Text fields (titles) can be any string
        processedValue = value;
      } else {
        const idMatch = value.match(/(\d{17,19})/);
        if (!idMatch) {
          await interaction.reply({ 
            content: '❌ Invalid ID format. Please provide a valid Discord ID or mention.', 
            flags: MessageFlags.Ephemeral 
          });
          return;
        }
        processedValue = idMatch[1];
      }
      
      // Handle nested properties (e.g., "supportTicketEmbed.title")
      let updates;
      if (setting.includes('.')) {
        const [parent, child] = setting.split('.');
        const config = getGuildConfig(guildId);
        updates = {
          [parent]: {
            ...config[parent],
            [child]: processedValue
          }
        };
      } else {
        updates = { [setting]: processedValue };
      }
      
      updateGuildConfig(guildId, updates);
      
      const settingNames = {
        supportRoleId: 'Support Role',
        supportTicketCategoryId: 'Support Ticket Category',
        roleTicketCategoryId: 'Role Request Category',
        loggingChannelId: 'Logging Channel',
        panelImageUrl: 'Panel Image URL (Global)',
        'supportTicketEmbed.title': 'Support Panel - Title',
        'supportTicketEmbed.panelDescription': 'Support Panel - Description',
        'supportTicketEmbed.imageUrl': 'Support Panel - Image URL',
        'roleRequestEmbed.title': 'Role Request Panel - Title',
        'roleRequestEmbed.panelDescription': 'Role Request Panel - Description',
        'roleRequestEmbed.imageUrl': 'Role Request Panel - Image URL',
      };
      
      await interaction.reply({ 
        content: `✅ **${settingNames[setting]}** has been updated!`, 
        flags: MessageFlags.Ephemeral 
      });
      
    } else if (subcommand === 'reset') {
      // Reset by setting an empty object (will merge with defaults)
      updateGuildConfig(guildId, {});
      
      await interaction.reply({ 
        content: '✅ Configuration has been reset to defaults!', 
        flags: MessageFlags.Ephemeral 
      });
    } else if (subcommand === 'reset-embeds') {
      // Reset only the embed text/colors to defaults, preserve IDs and other settings
      updateGuildConfig(guildId, {
        roleRequestEmbed: DEFAULT_CONFIG.roleRequestEmbed,
        supportTicketEmbed: DEFAULT_CONFIG.supportTicketEmbed,
      });

      await interaction.reply({
        content: '✅ Embed texts and colors reset to defaults. IDs and channels unchanged.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
