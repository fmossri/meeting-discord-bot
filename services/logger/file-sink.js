const fs = require('node:fs');
const { createStream } = require('rotating-file-stream');

/**
 * Size-based rotating log file (JSON lines). One stream per process.
 *
 * @param {{ dir: string, filename: string, maxSize: string, maxFiles: number }} opts
 * @returns {{ writeLine: (line: string) => void } | null}
 */
function createRotatingFileSink({ dir, filename, maxSize, maxFiles }) {
  if (!dir || !filename) {
    return null;
  }
  fs.mkdirSync(dir, { recursive: true });
  const stream = createStream(filename, {
    path: dir,
    size: maxSize,
    maxFiles: maxFiles,
  });
  return {
    writeLine(line) {
      const payload = line.endsWith('\n') ? line : `${line}\n`;
      stream.write(payload);
    },
  };
}

module.exports = {
  createRotatingFileSink,
};
