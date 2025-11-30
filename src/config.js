// ============================================================
//                       BOT CONFIGURATION
// Central bot configuration for IDs and server-specific settings.
// IMPORTANT:
// 1. Fill these with your server's actual IDs.
// 2. Do NOT commit secrets (like bot tokens) here.
// ============================================================

/**
 * ID NOTES:
 *  - guildId (optional): 
 *      If provided, slash commands will register immediately for this guild.
 *  - supportRoleId (optional): 
 *      The role ID for staff/support members to ping or allow access in tickets.
 *  - ticketCategoryId (Required): 
 *      The category ID where ticket channels will be created.
 */

module.exports = {

  // ==========================================================
  //                     BASIC SETTINGS
  // ==========================================================
  // ID of your server (guild) for slash command registration
  guildId: '1215946172334739556',

  // Role ID of your support/staff team (Optional)
  supportRoleId: '1233515268861460500',

  // Category ID for ticket channels (Default / legacy) - Leave blank if you want to use separate categories for support/role tickets
  ticketCategoryId: '',

  // Optional: separate category for support tickets (overrides ticketCategoryId when set)
  supportTicketCategoryId: '1444453127465074829',

  // Optional: separate category for role request tickets (overrides ticketCategoryId when set)
  roleTicketCategoryId: '1444453158272110796',


  // ==========================================================
  //                  ROLE REQUEST TICKET
  // ==========================================================

  // Embed configuration for Role Request Tickets
  roleRequestEmbed: {
    // Title shown on the embed
    title: 'ImperialRP Role Request Ticket',

    // Color of the embed in HEX format
    embedColor: '#940000',

    // Panel description shown on the role request panel.
    panelDescription: "Do you need help with Discord issues, in-game issues, or maybe you wish to appeal a warning? You are free to make a support ticket and members of the Discord Moderation team might be able to assist you.",

    // Description shown at the top of the embed once a ticket is made
    openDescription: 
      'Thank you for creating a Role Request. ' +
      'A Battalion XO+ will assign your roles shortly and will close the ticket when completed.\n\n' +
      'Please note this may take up to 24 Hours, so please be patient.',
  },

  // Optional image used on the role request panel
  panelImageUrl: 'https://i.ibb.co/dwz0jTnQ/icefuse-logo.png',

  // Initial message posted into newly-created role request tickets
  // Supports placeholders: {user} => mentions the requestor, {moderators} => mentions support role (if configured)
  roleRequestInitialMessage: '{user} has created a new role request ticket.',

  // Field labels used in the Role Request modal, the form users fill out.
  MODAL_LABELS: {
    ingame_name: 'What is your In-Game Name?',
    steamid64: 'What is your SteamID64?',
    battalion: 'What battalion/Spec are you requesting for?',
    roles: 'List all the roles you are requesting:',
  },
  
  // ==========================================================
  //                     ROLE REQUEST TICKET
  // ==========================================================

  // Embed configuration for Support Tickets
  supportTicketEmbed: {
    // Title shown on the embed
    title: 'ImperialRP Support Ticket',

    // Color of the embed in HEX format
    embedColor: '#940000',

    // Panel description shown on the support ticket panel.
    panelDescription: "Do you need help with Discord issues, in-game issues, or maybe you wish to appeal a warning? You are free to make a support ticket and members of the Discord Moderation team might be able to assist you.",

    // Description shown at the top of the embed once a ticket is made
    openDescription: 
      'Thank you for contacting support. A member of our support team will be with you shortly.\n\n' +
      'Please describe your issue in detail so we can assist you as quickly as possible.',
  },

  // Initial messages posted into newly-created ticket channels
  // Supports placeholders: {user} and {moderators}
  supportInitialMessage: '{moderators} {user} has opened a support ticket.',

  // ==========================================================
  //                  TICKET DELETION
  // ==========================================================
  // Configurable embed used when a ticket channel is scheduled for deletion.
  // Description supports {user} and {delay} placeholders.
  deletionEmbed: {
    title: 'Ticket Closing',
    description: 'Closing this ticket in {delay} seconds...',
    embedColor: '#940000',
  },

  // How many seconds to wait before deleting a ticket channel
  deletionDelaySeconds: 5,

  // Embed sent as a DM to the user when their ticket is closed.
  ticketClosureDmEmbed: {
    title: 'Your ticket has been Closed',
    description: 'If you require further assistance, feel free to open a new ticket at any time.',
    embedColor: '#FF0000',
    fields: [
      { name: 'Ticket', value: '``{ticketName}``', inline: true },
      { name: 'Created at', value: '{createdAt}', inline: true },
      { name: 'Closed at', value: '{closedAt}', inline: true },
      { name: 'Closed by', value: '{closedBy}', inline: false },
    ],
  },

  // ==========================================================
  //                  TICKET NOTIFICATIONS
  // ==========================================================
  // Channel ID where ticket creation and closure notifications are sent
  // Leave empty to disable notifications
  ticketNotificationChannelId: '1444374349036523581',

  // Embed sent to the notification channel when a ticket is created
  // Supports placeholders: {user}, {ticketName}, {ticketType}, {ticketChannel}
  ticketCreationNotificationEmbed: {
    title: 'Ticket Created',
    description: '{user} has created a ticket.',
    embedColor: '#08aad1',
    fields: [
      { name: 'Ticket', value: '#{ticketNumber}', inline: true },
    ],
  },

  // Embed sent to the notification channel when a ticket is closed
  // Supports placeholders: {user}, {ticketName}, {ticketType}, {closedBy}
  ticketClosureNotificationEmbed: {
    title: 'Ticket Closed',
    description: '{closedBy} has closed a ticket.',
    embedColor: '#067894',
    fields: [
      { name: 'Ticket', value: '#{ticketNumber}', inline: true },
    ],
  },

};
