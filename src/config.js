// Central bot configuration for IDs and server-specific settings.
// Fill these with your server's values. Do not commit secrets here (like tokens).

/**
 * ID notes:
 * - guildId (optional): If set, slash commands will register immediately to this guild.
 * - supportRoleId (optional): Role to ping/allow access in tickets.
 * - ticketCategoryId (optional): Category under which ticket channels will be created.
 *   If not set, tickets are created as private threads in the channel where the panel button was used.
 */

module.exports = {
  // e.g., '123456789012345678'
  guildId: '1215946172334739556',

  // e.g., '234567890123456789' (support staff role)
  supportRoleId: '1233515268861460500',

  // e.g., '345678901234567890' (category for ticket channels)
  ticketCategoryId: '1444361824643317861',
};
