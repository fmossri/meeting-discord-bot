const { createSessionManager } = require('../../../services/session-manager/session-manager.js');

const TARGET_CHUNK_SECONDS = 30;
const SAMPLE_RATE = 16000;
const TARGET_BYTES = TARGET_CHUNK_SECONDS * SAMPLE_RATE * 2;

function createMockSessionStore(session = null) {
	return {
		getSessionById: jest.fn().mockReturnValue(session),
	};
}

function createMockTranscriptWorker(overrides = {}) {
	return {
		startTranscript: jest.fn().mockResolvedValue('/tmp/test-transcript.jsonl'),
		enqueueChunk: jest.fn().mockResolvedValue(undefined),
		closeTranscript: jest.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

function createMockReportGenerator(reportPath = '/tmp/test-report.md') {
	return {
		generateReport: jest.fn().mockResolvedValue(reportPath),
	};
}

function createMockSummaryGenerator(summaryText = 'Test summary.') {
	return {
		generateSummary: jest.fn().mockResolvedValue(summaryText),
	};
}

function createSessionWithParticipantStates(participantStates = new Map()) {
	return {
		voiceChannelId: 'voice-123',
		participantStates,
	};
}

describe('Session Manager', () => {
	describe('startSession', () => {
		it('returns false and does not call transcriptWorker.startTranscript when session is not in store', async () => {
			const sessionStore = createMockSessionStore(undefined);
			const transcriptWorker = createMockTranscriptWorker();
			const sessionManager = createSessionManager({
				sessionStore,
				createReportGenerator: () => createMockReportGenerator(),
				createSummaryGenerator: () => createMockSummaryGenerator(),
				transcriptWorker,
			});

			const result = await sessionManager.startSession('session-1');

			expect(result).toBe(false);
			expect(transcriptWorker.startTranscript).not.toHaveBeenCalled();
		});

		it('calls transcriptWorker.startTranscript and returns true when session is in store', async () => {
			const session = createSessionWithParticipantStates();
			const sessionStore = createMockSessionStore(session);
			const transcriptWorker = createMockTranscriptWorker();
			const sessionManager = createSessionManager({
				sessionStore,
				createReportGenerator: () => createMockReportGenerator(),
				createSummaryGenerator: () => createMockSummaryGenerator(),
				transcriptWorker,
			});

			const result = await sessionManager.startSession('session-1');

			expect(result).toBe(true);
			expect(transcriptWorker.startTranscript).toHaveBeenCalledTimes(1);
			expect(transcriptWorker.startTranscript).toHaveBeenCalledWith('session-1');
		});

		it('returns false when transcriptWorker.startTranscript throws', async () => {
			const session = createSessionWithParticipantStates();
			const sessionStore = createMockSessionStore(session);
			const transcriptWorker = createMockTranscriptWorker({
				startTranscript: jest.fn().mockRejectedValue(new Error('start failed')),
			});
			const sessionManager = createSessionManager({
				sessionStore,
				createReportGenerator: () => createMockReportGenerator(),
				createSummaryGenerator: () => createMockSummaryGenerator(),
				transcriptWorker,
			});

			const result = await sessionManager.startSession('session-1');

			expect(result).toBe(false);
		});
	});

	describe('closeSession', () => {
		it('throws "session not found." when session was never started', async () => {
			const sessionStore = createMockSessionStore(createSessionWithParticipantStates());
			const sessionManager = createSessionManager({
				sessionStore,
				createReportGenerator: () => createMockReportGenerator(),
				createSummaryGenerator: () => createMockSummaryGenerator(),
				transcriptWorker: createMockTranscriptWorker(),
			});

			await expect(sessionManager.closeSession('session-1')).rejects.toThrow('session not found.');
		});

		it('awaits processing, calls closeTranscript and generators, deletes session, and returns reportPath and summary', async () => {
			const session = createSessionWithParticipantStates(new Map([['u1', { displayName: 'Alice' }]]));
			const sessionStore = createMockSessionStore(session);
			const transcriptWorker = createMockTranscriptWorker();
			const mockReportPath = '/tmp/report.md';
			const mockSummaryText = 'Summary text.';
			const sessionManager = createSessionManager({
				sessionStore,
				createReportGenerator: () => createMockReportGenerator(mockReportPath),
				createSummaryGenerator: () => createMockSummaryGenerator(mockSummaryText),
				transcriptWorker,
			});

			await sessionManager.startSession('session-1');
			const result = await sessionManager.closeSession('session-1');

			expect(transcriptWorker.closeTranscript).toHaveBeenCalledWith('session-1', {
				channelId: 'voice-123',
				participantDisplayNames: ['Alice'],
			});
			expect(result).toEqual({ reportPath: mockReportPath, summary: mockSummaryText });
			await expect(sessionManager.closeSession('session-1')).rejects.toThrow('session not found.');
		});

		it('throws when transcriptWorker.closeTranscript throws', async () => {
			const session = createSessionWithParticipantStates();
			const sessionStore = createMockSessionStore(session);
			const transcriptWorker = createMockTranscriptWorker({
				closeTranscript: jest.fn().mockRejectedValue(new Error('close failed')),
			});
			const sessionManager = createSessionManager({
				sessionStore,
				createReportGenerator: () => createMockReportGenerator(),
				createSummaryGenerator: () => createMockSummaryGenerator(),
				transcriptWorker,
			});

			await sessionManager.startSession('session-1');

			await expect(sessionManager.closeSession('session-1')).rejects.toThrow('close failed');
		});
	});

	describe('chunkStream', () => {
		it('returns false when session is not in sessionStates', () => {
			const session = createSessionWithParticipantStates(new Map([['u1', { displayName: 'A', pcmStream: { on: jest.fn() }, chunkerState: {} }]]));
			const sessionStore = createMockSessionStore(session);
			const transcriptWorker = createMockTranscriptWorker();
			const sessionManager = createSessionManager({
				sessionStore,
				createReportGenerator: () => createMockReportGenerator(),
				createSummaryGenerator: () => createMockSummaryGenerator(),
				transcriptWorker,
			});

			const result = sessionManager.chunkStream('session-1', 'u1');

			expect(result).toBe(false);
			expect(transcriptWorker.enqueueChunk).not.toHaveBeenCalled();
		});

		it('returns false when participant is not in participantStates', async () => {
			const participantStates = new Map();
			const session = createSessionWithParticipantStates(participantStates);
			const sessionStore = createMockSessionStore(session);
			const transcriptWorker = createMockTranscriptWorker();
			const sessionManager = createSessionManager({
				sessionStore,
				createReportGenerator: () => createMockReportGenerator(),
				createSummaryGenerator: () => createMockSummaryGenerator(),
				transcriptWorker,
			});

			await sessionManager.startSession('session-1');
			const result = sessionManager.chunkStream('session-1', 'nonexistent');

			expect(result).toBe(false);
			expect(transcriptWorker.enqueueChunk).not.toHaveBeenCalled();
		});

		it('calls transcriptWorker.enqueueChunk when stream emits enough PCM data', async () => {
			const { EventEmitter } = require('events');
			const pcmStream = new EventEmitter();
			const participantStates = new Map([
				[
					'u1',
					{
						displayName: 'Alice',
						pcmStream,
						chunkerState: {
							samplesBuffer: Buffer.alloc(0),
							samplesInBuffer: 0,
							totalSamplesEmitted: 0,
						},
					},
				],
			]);
			const session = createSessionWithParticipantStates(participantStates);
			const sessionStore = createMockSessionStore(session);
			const transcriptWorker = createMockTranscriptWorker();
			const sessionManager = createSessionManager({
				sessionStore,
				createReportGenerator: () => createMockReportGenerator(),
				createSummaryGenerator: () => createMockSummaryGenerator(),
				transcriptWorker,
			});

			await sessionManager.startSession('session-1');
			sessionManager.chunkStream('session-1', 'u1');

			pcmStream.emit('data', Buffer.alloc(TARGET_BYTES));

			await new Promise((r) => setImmediate(r));
			await new Promise((r) => setImmediate(r));

			expect(transcriptWorker.enqueueChunk).toHaveBeenCalled();
			expect(transcriptWorker.enqueueChunk).toHaveBeenCalledWith('session-1', expect.objectContaining({
				participantData: { participantId: 'u1', displayName: 'Alice' },
				chunkStartTimeMs: 0,
				chunkEndTimeMs: TARGET_CHUNK_SECONDS * 1000,
				audio: expect.any(Buffer),
			}));
		});
	});
});
