const LEVELS = ['debug', 'info', 'warn', 'error', 'silent'];

const { createRotatingFileSink } = require('./file-sink.js');

// Minimum level to log, defaults to 'info' if unset or invalid. 'silent' = no output.
const ENV_LEVEL = process.env.LOG_LEVEL;
const MIN_LEVEL = LEVELS.includes(ENV_LEVEL) ? ENV_LEVEL : 'info';
const MIN_INDEX = LEVELS.indexOf(MIN_LEVEL);

const LOG_FILE_DIR = process.env.LOG_FILE_DIR?.trim() || '';
const LOG_FILE_NAME = process.env.LOG_FILE_NAME?.trim() || 'tsummix.log';
const LOG_FILE_MAX_SIZE = process.env.LOG_FILE_MAX_SIZE?.trim() || '10M';
const LOG_FILE_MAX_FILES_RAW = process.env.LOG_FILE_MAX_FILES;
const LOG_FILE_MAX_FILES = (() => {
  const n = Number(LOG_FILE_MAX_FILES_RAW);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 14;
})();

function parseEnvBool(name, defaultValue) {
  const raw = process.env[name];
  if (raw == null || raw === '') {
    return defaultValue;
  }
  return String(raw).toLowerCase().trim() === 'true';
}

// When writing to rotated files for Promtail, default stdout off to avoid duplicate lines in Loki
// (Docker log driver + file scrape). Override with LOG_TO_STDOUT=true for debugging.
const LOG_TO_STDOUT = LOG_FILE_DIR === '' ? true : parseEnvBool('LOG_TO_STDOUT', false);

let fileSink = null;
function getFileSink() {
  if (!LOG_FILE_DIR) {
    return null;
  }
  if (!fileSink) {
    try {
      fileSink = createRotatingFileSink({
        dir: LOG_FILE_DIR,
        filename: LOG_FILE_NAME,
        maxSize: LOG_FILE_MAX_SIZE,
        maxFiles: LOG_FILE_MAX_FILES,
      });
    } catch {
      fileSink = null;
    }
  }
  return fileSink;
}

function shouldLog(level) {
  if (MIN_LEVEL === 'silent') return false;
  const idx = LEVELS.indexOf(level);
  return idx !== -1 && idx >= MIN_INDEX;
}

function emitLine(line) {
  if (LOG_TO_STDOUT) {
    try {
      process.stdout.write(line);
    } catch {
      // ignore
    }
  }
  const sink = getFileSink();
  if (sink) {
    try {
      sink.writeLine(line);
    } catch {
      // ignore
    }
  }
}

function log(level, component, event, message, context = {}) {
  if (!shouldLog(level)) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component,
    event,
    message,
    context,
  };

  try {
    emitLine(JSON.stringify(entry) + '\n');
  } catch {
    // If logging itself fails, we do not throw; avoid breaking the app on log errors.
  }
}

module.exports = {
  debug(component, event, message, context) {
    log('debug', component, event, message, context);
  },
  info(component, event, message, context) {
    log('info', component, event, message, context);
  },
  warn(component, event, message, context) {
    log('warn', component, event, message, context);
  },
  error(component, event, message, context) {
    log('error', component, event, message, context);
  },
};
