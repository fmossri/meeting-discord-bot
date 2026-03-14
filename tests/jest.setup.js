// Keep test output readable: no JSON log lines during tests.
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';

// Avoid Jest reporter RangeError when terminal width is missing or invalid (e.g. WSL, some IDEs).
// Cause: Jest's default reporter draws a progress bar using (terminal width - filled length). If
// process.stdout.columns is undefined, 0, or very small, that expression can go negative; the reporter
// then calls String.repeat(negativeNumber), which throws RangeError: Invalid count value.
if (process.stdout && (typeof process.stdout.columns !== 'number' || process.stdout.columns < 120)) {
  process.stdout.columns = 120;
}

