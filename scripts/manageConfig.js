#!/usr/bin/env node

/**
 * Database Configuration Utility
 * 
 * This script allows you to view and modify server configurations directly
 * in the database without needing to use Discord commands.
 * 
 * Usage:
 *   node scripts/manageConfig.js view <guild_id>
 *   node scripts/manageConfig.js export <guild_id> [output.json]
 *   node scripts/manageConfig.js import <guild_id> <config.json>
 *   node scripts/manageConfig.js list
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'RedTickets.db');

if (!fs.existsSync(dbPath)) {
  console.error('❌ Database not found. Please run the bot at least once to create it.');
  process.exit(1);
}

const db = new Database(dbPath, { readonly: false });

// Initialize tables if they don't exist
const createGuildConfigsTable = `
CREATE TABLE IF NOT EXISTS guild_configs (
  guild_id TEXT PRIMARY KEY,
  config_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`;
db.exec(createGuildConfigsTable);

const command = process.argv[2];
const guildId = process.argv[3];

function listGuilds() {
  console.log('\n📋 Configured Servers:\n');
  const stmt = db.prepare('SELECT guild_id, updated_at FROM guild_configs ORDER BY updated_at DESC');
  const rows = stmt.all();
  
  if (rows.length === 0) {
    console.log('  No servers configured yet.');
  } else {
    rows.forEach(row => {
      const date = new Date(row.updated_at).toLocaleString();
      console.log(`  🔹 ${row.guild_id} (updated: ${date})`);
    });
  }
  console.log();
}

function viewConfig(guildId) {
  const stmt = db.prepare('SELECT config_json FROM guild_configs WHERE guild_id = ?');
  const row = stmt.get(guildId);
  
  if (!row) {
    console.log(`\n❌ No configuration found for guild: ${guildId}`);
    console.log('   This server is using default configuration.\n');
    return;
  }
  
  console.log(`\n📊 Configuration for guild: ${guildId}\n`);
  const config = JSON.parse(row.config_json);
  console.log(JSON.stringify(config, null, 2));
  console.log();
}

function exportConfig(guildId, outputFile) {
  const stmt = db.prepare('SELECT config_json FROM guild_configs WHERE guild_id = ?');
  const row = stmt.get(guildId);
  
  if (!row) {
    console.log(`❌ No configuration found for guild: ${guildId}`);
    process.exit(1);
  }
  
  const output = outputFile || `config_${guildId}.json`;
  fs.writeFileSync(output, row.config_json, 'utf8');
  console.log(`\n✅ Configuration exported to: ${output}\n`);
}

function importConfig(guildId, inputFile) {
  if (!fs.existsSync(inputFile)) {
    console.log(`❌ File not found: ${inputFile}`);
    process.exit(1);
  }
  
  const configJson = fs.readFileSync(inputFile, 'utf8');
  
  // Validate JSON
  try {
    JSON.parse(configJson);
  } catch (err) {
    console.log(`❌ Invalid JSON in file: ${inputFile}`);
    console.log(err.message);
    process.exit(1);
  }
  
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO guild_configs (guild_id, config_json, updated_at) 
    VALUES (?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET config_json = excluded.config_json, updated_at = excluded.updated_at
  `);
  
  stmt.run(guildId, configJson, now);
  console.log(`\n✅ Configuration imported for guild: ${guildId}\n`);
}

// Main
if (!command) {
  console.log(`
Database Configuration Utility

Usage:
  node scripts/manageConfig.js list
  node scripts/manageConfig.js view <guild_id>
  node scripts/manageConfig.js export <guild_id> [output.json]
  node scripts/manageConfig.js import <guild_id> <config.json>

Examples:
  node scripts/manageConfig.js list
  node scripts/manageConfig.js view 1215946172334739556
  node scripts/manageConfig.js export 1215946172334739556 backup.json
  node scripts/manageConfig.js import 9876543210987654321 server_config.json
  `);
  process.exit(0);
}

switch (command) {
  case 'list':
    listGuilds();
    break;
    
  case 'view':
    if (!guildId) {
      console.log('❌ Please provide a guild ID');
      process.exit(1);
    }
    viewConfig(guildId);
    break;
    
  case 'export':
    if (!guildId) {
      console.log('❌ Please provide a guild ID');
      process.exit(1);
    }
    exportConfig(guildId, process.argv[4]);
    break;
    
  case 'import':
    if (!guildId) {
      console.log('❌ Please provide a guild ID');
      process.exit(1);
    }
    const inputFile = process.argv[4];
    if (!inputFile) {
      console.log('❌ Please provide an input file');
      process.exit(1);
    }
    importConfig(guildId, inputFile);
    break;
    
  default:
    console.log(`❌ Unknown command: ${command}`);
    console.log('   Run without arguments to see usage.');
    process.exit(1);
}

db.close();
