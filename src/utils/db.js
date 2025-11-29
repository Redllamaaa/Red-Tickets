const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'RedTickets.db');
const db = new Database(dbPath);

// Pragmas for better durability/concurrency
try {
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
} catch {}

// Schema
const createCounters = `
CREATE TABLE IF NOT EXISTS ticket_counters (
  guild_id TEXT NOT NULL,
  battalion_key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, battalion_key)
);
`;
db.exec(createCounters);

const getStmt = db.prepare('SELECT count FROM ticket_counters WHERE guild_id = ? AND battalion_key = ?');
const insertStmt = db.prepare('INSERT INTO ticket_counters (guild_id, battalion_key, count) VALUES (?, ?, 0)');
const updateStmt = db.prepare('UPDATE ticket_counters SET count = count + 1 WHERE guild_id = ? AND battalion_key = ?');

const txNext = db.transaction((guildId, key) => {
  const row = getStmt.get(guildId, key);
  if (!row) insertStmt.run(guildId, key);
  updateStmt.run(guildId, key);
  const after = getStmt.get(guildId, key);
  return after.count;
});

function getNextTicketNumber(guildId, battalionKey) {
  if (!guildId) throw new Error('guildId is required');
  if (!battalionKey) throw new Error('battalionKey is required');
  return txNext(guildId, battalionKey);
}

module.exports = {
  db,
  getNextTicketNumber,
};
