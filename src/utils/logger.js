const { inspect } = require('util');

function ts() {
  return new Date().toISOString();
}

// Helper to parse color from config (supports hex string or number)
function parseColor(val) {
  if (typeof val === 'string') {
    if (val.startsWith('#')) return parseInt(val.slice(1), 16);
    return parseInt(val, 16);
  }
  return val;
}

function fmtMeta(meta) {
  if (!meta) return '';
  try {
    const base = {
      guildId: meta.guildId || meta.guild?.id,
      channelId: meta.channelId || meta.channel?.id,
      userId: meta.userId || meta.user?.id || meta.member?.id,
      interactionId: meta.interactionId || meta.id,
      context: meta.context,
    };
    return Object.entries(base)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
  } catch {
    try { return inspect(meta, { depth: 1 }); } catch { return ''; }
  }
}

function log(level, message, meta, err) {
  const metaStr = fmtMeta(meta);
  const line = `[${ts()}] ${level.toUpperCase()} ${message}${metaStr ? ' | ' + metaStr : ''}`;
  if (level === 'error') {
    if (err) {
      // Ensure stack or inspected error is printed
      const details = err.stack || inspect(err, { depth: 2 });
      console.error(line + '\n' + details);
    } else {
      console.error(line);
    }
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

module.exports = {
  info(message, meta) { log('info', message, meta); },
  warn(message, meta) { log('warn', message, meta); },
  error(message, meta, err) { log('error', message, meta, err); },
  debug(message, meta) { if (process.env.DEBUG) log('debug', message, meta); },
  parseColor,
};
