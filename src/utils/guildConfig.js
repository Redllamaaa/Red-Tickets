const { db } = require('./db');
const logger = require('./logger');

// Default configuration template used for all guilds
const DEFAULT_CONFIG = {
  supportRoleId: null,
  ticketCategoryId: null,
  supportTicketCategoryId: null,
  roleTicketCategoryId: null,
  ticketNotificationChannelId: null,
  
  roleRequestEmbed: {
    title: 'Role Request Ticket',
    embedColor: '#940000',
    panelDescription: 'Need a role assigned? Click below to create a role request ticket.',
    openDescription: 'Thank you for creating a Role Request. A staff member will assist you shortly.\n\nPlease note this may take up to 24 hours, so please be patient.',
  },
  
  supportTicketEmbed: {
    title: 'Support Ticket',
    embedColor: '#940000',
    panelDescription: 'Do you need help with Discord issues, in-game issues, or maybe you wish to appeal a warning? You are free to make a support ticket and members of the support team might be able to assist you.',
    openDescription: 'Thank you for contacting support. A member of our support team will be with you shortly.\n\nPlease describe your issue in detail so we can assist you as quickly as possible.',
  },
  
  panelImageUrl: null,
  roleRequestInitialMessage: '{user} has created a new role request ticket.',
  supportInitialMessage: '{moderators} {user} has opened a support ticket.',
  
  MODAL_LABELS: {
    ingame_name: 'What is your In-Game Name?',
    steamid64: 'What is your SteamID64?',
    battalion: 'What battalion/Spec are you requesting for?',
    roles: 'List all the roles you are requesting:',
  },
  
  deletionEmbed: {
    title: 'Ticket Closing',
    description: 'Closing this ticket in {delay} seconds...',
    embedColor: '#940000',
  },
  
  deletionDelaySeconds: 5,
  
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
  
  ticketCreationNotificationEmbed: {
    title: 'Ticket Created',
    description: '{user} has created a ticket.',
    embedColor: '#08aad1',
    fields: [
      { name: 'Ticket', value: '#{ticketNumber}', inline: true },
    ],
  },
  
  ticketClosureNotificationEmbed: {
    title: 'Ticket Closed',
    description: '{closedBy} has closed a ticket.',
    embedColor: '#067894',
    fields: [
      { name: 'Ticket', value: '#{ticketNumber}', inline: true },
    ],
  },
};

// Create guild_configs table
const createGuildConfigsTable = `
CREATE TABLE IF NOT EXISTS guild_configs (
  guild_id TEXT PRIMARY KEY,
  config_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`;
db.exec(createGuildConfigsTable);

const getConfigStmt = db.prepare('SELECT config_json FROM guild_configs WHERE guild_id = ?');
const upsertConfigStmt = db.prepare(`
  INSERT INTO guild_configs (guild_id, config_json, updated_at) 
  VALUES (?, ?, ?)
  ON CONFLICT(guild_id) DO UPDATE SET config_json = excluded.config_json, updated_at = excluded.updated_at
`);

/**
 * Get configuration for a specific guild
 * @param {string} guildId - The guild ID
 * @returns {Object} The guild configuration (merged with defaults)
 */
function getGuildConfig(guildId) {
  if (!guildId) {
    logger.warn('getGuildConfig called without guildId, returning defaults');
    return { ...DEFAULT_CONFIG };
  }

  try {
    const row = getConfigStmt.get(guildId);
    if (row) {
      const stored = JSON.parse(row.config_json);
      // Deep merge with defaults to ensure all fields exist
      return deepMerge(DEFAULT_CONFIG, stored);
    }
    // No config found, return defaults
    return { ...DEFAULT_CONFIG };
  } catch (err) {
    logger.error('Failed to get guild config', { guildId }, err);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save configuration for a specific guild
 * @param {string} guildId - The guild ID
 * @param {Object} config - The configuration object to save
 */
function setGuildConfig(guildId, config) {
  if (!guildId) {
    throw new Error('guildId is required');
  }

  try {
    const now = Date.now();
    upsertConfigStmt.run(guildId, JSON.stringify(config), now);
    logger.info('Guild config saved', { guildId });
  } catch (err) {
    logger.error('Failed to save guild config', { guildId }, err);
    throw err;
  }
}

/**
 * Update specific fields in a guild's configuration
 * @param {string} guildId - The guild ID
 * @param {Object} updates - Object with fields to update
 */
function updateGuildConfig(guildId, updates) {
  const current = getGuildConfig(guildId);
  const merged = deepMerge(current, updates);
  setGuildConfig(guildId, merged);
  return merged;
}

/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          output[key] = source[key];
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        output[key] = source[key];
      }
    });
  }
  
  return output;
}

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

module.exports = {
  getGuildConfig,
  setGuildConfig,
  updateGuildConfig,
  DEFAULT_CONFIG,
};
