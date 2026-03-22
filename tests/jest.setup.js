// Keep test output readable: no JSON log lines during tests.
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
delete process.env.LOG_FILE_DIR;
delete process.env.LOG_TO_STDOUT;

