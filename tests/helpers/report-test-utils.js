const { Readable } = require('node:stream');

/**
 * Returns a minimal valid transcript JSONL string for testing.
 * @param {object} [overrides] - Override metadata or segments
 * @returns {string}
 */
function createMinimalTranscriptContent(overrides = {}) {
    const metadata = {
        type: 'metadata',
        transcriptId: 'test-transcript-1',
        channelId: 'test-ch-123',
        meetingStartIso: '2025-01-15T14:30:00.000Z',
        participantDisplayNames: ['Alice', 'Bob'],
        ...overrides.metadata,
    };
    const segments = overrides.segments ?? [
        { transcriptId: 'test-transcript-1', chunkId: 1, participantId: 'u1', displayName: 'Alice', startMs: 0, endMs: 5000, text: 'Hello, this is a test segment.' },
        { transcriptId: 'test-transcript-1', chunkId: 2, participantId: 'u2', displayName: 'Bob', startMs: 5000, endMs: 10000, text: 'Hi Alice, I agree with that.' },
    ];
    const lines = [JSON.stringify(metadata), ...segments.map(s => JSON.stringify(s))];
    return lines.join('\n');
}

/**
 * Returns a minimal report markdown string for testing.
 * @param {object} [overrides] - Override content
 * @returns {string}
 */
function createMinimalReportContent(overrides = {}) {
    const defaultContent = [
        '# Transcript for test-meeting on test-ch at 15 January 2025, 14:30:00',
        '## Participants: Alice, Bob',
        '```text',
        ' 14:30:00 | Alice | Hello, this is a test.',
        ' 14:30:05 | Bob   | I agree.',
        '```',
    ].join('\n');
    return overrides.content ?? defaultContent;
}

/**
 * Creates a Readable stream from a string (for mocking fs.createReadStream).
 * @param {string} content
 * @returns {import('stream').Readable}
 */
function createReadStreamFromString(content) {
    return Readable.from([content]);
}

module.exports = {
    createMinimalTranscriptContent,
    createMinimalReportContent,
    createReadStreamFromString,
};
