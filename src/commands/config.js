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
      {
        name: 'manage-role-support',
        description: 'Manage role request support team',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'action',
            description: 'Action to perform',
            type: 3, // STRING
            required: true,
            choices: [
              { name: 'Add Role(s)', value: 'add' },
              { name: 'Remove Role(s)', value: 'remove' },
              { name: 'View Roles', value: 'view' },
              { name: 'Clear All', value: 'clear' },
            ],
          },
          {
            name: 'roles',
            description: 'Role mentions separated by spaces (e.g., @Role1 @Role2 @Role3)',
            type: 3, // STRING
            required: false,
          },
        ],
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
            name: 'Role Request Support Roles', 
            value: config.roleRequestSupportRoleIds && config.roleRequestSupportRoleIds.length > 0 
              ? config.roleRequestSupportRoleIds.map(id => `<@&${id}>`).join(', ')
              : '❌ Not set (using general support role)',
            inline: false 
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
    } else if (subcommand === 'manage-role-support') {
      const action = interaction.options.getString('action');
      const rolesString = interaction.options.getString('roles');
      const config = getGuildConfig(guildId);
      const currentRoles = config.roleRequestSupportRoleIds || [];

      if (action === 'view') {
        if (currentRoles.length === 0) {
          await interaction.reply({
            content: '📋 **Role Request Support Team**\n\nNo roles configured. Role requests will use the general support role.\n\n*Use `/config manage-role-support action:add roles:@Role1 @Role2` to add roles.*',
            flags: MessageFlags.Ephemeral,
          });
        } else {
          const roleList = currentRoles.map(id => `<@&${id}>`).join('\n');
          await interaction.reply({
            content: `📋 **Role Request Support Team**\n\n${roleList}\n\n*Total: ${currentRoles.length} role(s)*`,
            flags: MessageFlags.Ephemeral,
          });
        }
      } else if (action === 'clear') {
        if (currentRoles.length === 0) {
          await interaction.reply({
            content: '❌ Role request support team is already empty.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        updateGuildConfig(guildId, { roleRequestSupportRoleIds: [] });

        await interaction.reply({
          content: `✅ Cleared all roles from the role request support team (${currentRoles.length} role(s) removed).`,
          flags: MessageFlags.Ephemeral,
        });
      } else if (action === 'add' || action === 'remove') {
        if (!rolesString) {
          await interaction.reply({
            content: `❌ Please specify at least one role to ${action}.\n\nExample: \`/config manage-role-support action:${action} roles:@Role1 @Role2 @Role3\``,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        // Parse role IDs from mentions (format: <@&123456789012345678>)
        const roleIdMatches = rolesString.matchAll(/<@&(\d{17,19})>/g);
        const roleIds = [...roleIdMatches].map(match => match[1]);

        if (roleIds.length === 0) {
          await interaction.reply({
            content: '❌ No valid role mentions found. Please mention roles using @Role format.\n\nExample: `/config manage-role-support action:add roles:@Role1 @Role2`',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        // Fetch role objects to validate they exist and for display
        const validRoles = [];
        const invalidIds = [];
        
        for (const roleId of roleIds) {
          const role = interaction.guild.roles.cache.get(roleId);
          if (role) {
            validRoles.push(role);
          } else {
            invalidIds.push(roleId);
          }
        }

        if (validRoles.length === 0) {
          await interaction.reply({
            content: '❌ None of the specified roles were found in this server.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (action === 'add') {
          const alreadyAdded = [];
          const newlyAdded = [];

          validRoles.forEach(role => {
            if (currentRoles.includes(role.id)) {
              alreadyAdded.push(role);
            } else {
              newlyAdded.push(role);
            }
          });

          if (newlyAdded.length === 0) {
            const roleList = alreadyAdded.map(r => r.toString()).join(', ');
            await interaction.reply({
              content: `❌ All specified roles are already in the role request support team: ${roleList}`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const updatedRoles = [...currentRoles, ...newlyAdded.map(r => r.id)];
          updateGuildConfig(guildId, { roleRequestSupportRoleIds: updatedRoles });

          let message = `✅ Added ${newlyAdded.length} role(s) to the role request support team:\n${newlyAdded.map(r => r.toString()).join(', ')}`;
          if (alreadyAdded.length > 0) {
            message += `\n\n⚠️ Already added (skipped): ${alreadyAdded.map(r => r.toString()).join(', ')}`;
          }
          if (invalidIds.length > 0) {
            message += `\n\n⚠️ Invalid role IDs (skipped): ${invalidIds.length}`;
          }

          await interaction.reply({
            content: message,
            flags: MessageFlags.Ephemeral,
          });
        } else if (action === 'remove') {
          const notFound = [];
          const removed = [];

          validRoles.forEach(role => {
            if (currentRoles.includes(role.id)) {
              removed.push(role);
            } else {
              notFound.push(role);
            }
          });

          if (removed.length === 0) {
            const roleList = notFound.map(r => r.toString()).join(', ');
            await interaction.reply({
              content: `❌ None of the specified roles are in the role request support team: ${roleList}`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const updatedRoles = currentRoles.filter(id => !removed.some(r => r.id === id));
          updateGuildConfig(guildId, { roleRequestSupportRoleIds: updatedRoles });

          let message = `✅ Removed ${removed.length} role(s) from the role request support team:\n${removed.map(r => r.toString()).join(', ')}`;
          if (notFound.length > 0) {
            message += `\n\n⚠️ Not found (skipped): ${notFound.map(r => r.toString()).join(', ')}`;
          }
          if (invalidIds.length > 0) {
            message += `\n\n⚠️ Invalid role IDs (skipped): ${invalidIds.length}`;
          }

          await interaction.reply({
            content: message,
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    }
  },
};
