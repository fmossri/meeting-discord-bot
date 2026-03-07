const { createMinimalReportContent } = require('../../helpers/report-test-utils');
const { createSummaryGenerator } = require('../../../services/report-generator/summary-generator.js');

const mockComplete = jest.fn().mockResolvedValue('Mocked summary of the meeting.');

describe('generateSummary', () => {
    let mockFs, generator;
    const originalEnv = { ...process.env };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.LLM_PROVIDER = 'ollama';
        delete process.env.LLM_TRUNCATION_ENABLED;
        delete process.env.LLM_TRUNCATION_MAX_CHARS;
        delete process.env.LLM_SYSTEM_PROMPT;
        mockFs = {
            promises: {
                readFile: jest.fn().mockResolvedValue(createMinimalReportContent()),
            },
        };
        generator = createSummaryGenerator({
            fsImpl: mockFs,
            adaptersOverride: { ollama: { complete: mockComplete } },
        });
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('calls the LLM adapter with report content and returns the summary', async () => {
        const summary = await generator.generateSummary('any-path');
        expect(summary).toBe('Mocked summary of the meeting.');
        expect(mockComplete).toHaveBeenCalledTimes(1);
        expect(mockFs.promises.readFile).toHaveBeenCalledWith('any-path', 'utf8');
        const [system, user] = mockComplete.mock.calls[0];
        expect(system).toContain('assistente que resume reuniões');
        expect(user).toContain('Hello, this is a test');
        expect(user).toContain('I agree');
    });

    it('throws when LLM_PROVIDER is not set', async () => {
        delete process.env.LLM_PROVIDER;
        const gen = createSummaryGenerator({
            fsImpl: mockFs,
            adaptersOverride: { ollama: { complete: mockComplete } },
        });
        await expect(gen.generateSummary('any-path')).rejects.toThrow('LLM_PROVIDER must be set in .env');
        expect(mockComplete).not.toHaveBeenCalled();
    });

    it('throws when LLM_PROVIDER is invalid', async () => {
        process.env.LLM_PROVIDER = 'unknown-provider';
        const gen = createSummaryGenerator({
            fsImpl: mockFs,
            adaptersOverride: { ollama: { complete: mockComplete } },
        });
        await expect(gen.generateSummary('any-path')).rejects.toThrow('Invalid LLM_PROVIDER: unknown-provider');
        expect(mockComplete).not.toHaveBeenCalled();
    });

    it('passes options to the adapter', async () => {
        await generator.generateSummary('any-path', { temperature: 0.5 });
        expect(mockComplete).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            { temperature: 0.5 }
        );
    });

    it('uses chunk-and-combine when truncation is enabled and report exceeds maxChars', async () => {
        process.env.LLM_TRUNCATION_ENABLED = 'true';
        process.env.LLM_TRUNCATION_MAX_CHARS = '50';
        const chunkSummaries = ['Summary of part 1', 'Summary of part 2', 'Summary of part 3', 'Summary of part 4'];
        const finalSummary = 'Combined final summary';
        let callIndex = 0;
        mockComplete.mockImplementation(() => {
            const i = callIndex++;
            return Promise.resolve(i < chunkSummaries.length ? chunkSummaries[i] : finalSummary);
        });
        const summary = await generator.generateSummary('any-path');
        expect(summary).toBe(finalSummary);
        expect(mockComplete.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
});
