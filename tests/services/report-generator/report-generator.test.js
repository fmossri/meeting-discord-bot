const {
    createMinimalTranscriptContent,
    createReadStreamFromString,
} = require('../../helpers/report-test-utils');
const { createReportGenerator } = require('../../../services/report-generator/report-generator.js');

describe('generateReport', () => {
    let mockFs, mockPath, generator;

    beforeEach(() => {
        mockFs = {
            createReadStream: jest.fn(),
            mkdirSync: jest.fn(),
            writeFileSync: jest.fn(),
        };
        mockPath = { join: jest.fn((...args) => args.join('/')) };
        generator = createReportGenerator({ fsImpl: mockFs, pathImpl: mockPath });
    });

    it('generates a report from a valid transcript', async () => {
        const transcriptContent = createMinimalTranscriptContent();
        mockFs.createReadStream.mockReturnValue(createReadStreamFromString(transcriptContent));
        const reportPath = await generator.generateReport('any-path');
        expect(mockFs.writeFileSync).toHaveBeenCalled();
        const [path, content] = mockFs.writeFileSync.mock.calls[0];
        expect(path).toMatch(/meeting-report_test-ch-123_.+\.md$/);
        expect(content).toContain('# Transcript for test-meeting-1 on test-ch-123');
        expect(content).toContain('## Participants: Alice, Bob');
        expect(content).toContain('Hello, this is a test segment.');
        expect(content).toContain('Hi Alice, I agree with that.');
    });

    it('returns the report file path', async () => {
        const transcriptContent = createMinimalTranscriptContent();
        mockFs.createReadStream.mockReturnValue(createReadStreamFromString(transcriptContent));
        const reportPath = await generator.generateReport('any-path');
        expect(mockPath.join).toHaveBeenCalled();
        expect(reportPath).toMatch(/meeting-report_test-ch-123_\d{14}\.md$/);
    });

    it('throws when first line is not metadata', async () => {
        const invalidContent = '{"type":"segment","text":"wrong"}\n';
        mockFs.createReadStream.mockReturnValue(createReadStreamFromString(invalidContent));
        await expect(generator.generateReport('any-path')).rejects.toThrow(
            'Invalid transcript file: first line must be type = metadata'
        );
        expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    });

    it('throws when metadata is incomplete', async () => {
        const invalidContent = '{"type":"metadata","meetingId":"m1"}\n';
        mockFs.createReadStream.mockReturnValue(createReadStreamFromString(invalidContent));
        await expect(generator.generateReport('any-path')).rejects.toThrow(
            'Invalid transcript file: metadata must contain meetingId, channelId, meetingStartIso, and participantDisplayNames'
        );
        expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    });

    it('skips segment lines with empty text', async () => {
        const transcriptContent = createMinimalTranscriptContent({
            metadata: { type: 'metadata', meetingId: 'm1', channelId: 'ch1', meetingStartIso: '2025-01-15T14:30:00.000Z', participantDisplayNames: ['Alice'] },
            segments: [
                { meetingId: 'm1', chunkId: 1, displayName: 'Alice', startMs: 0, endMs: 1000, text: '  ' },
                { meetingId: 'm1', chunkId: 2, displayName: 'Alice', startMs: 1000, endMs: 2000, text: 'Real content' },
            ],
        });
        mockFs.createReadStream.mockReturnValue(createReadStreamFromString(transcriptContent));
        await generator.generateReport('any-path');
        const [, content] = mockFs.writeFileSync.mock.calls[0];
        expect(content).not.toContain('  ');
        expect(content).toContain('Real content');
    });
});
