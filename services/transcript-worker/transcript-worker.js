const wav = require('node-wav');

const WAV_SAMPLE_RATE = 16000;
const WAV_CHANNELS = 1;
const MAX_RETRIES = 3;

function isValidWav(audioBuffer) {
	try {
		const result = wav.decode(audioBuffer);
		if (result.sampleRate !== WAV_SAMPLE_RATE || result.channelData.length !== WAV_CHANNELS) {
			return false;
		}
		return true;
	} catch (error) {
		console.error('Error decoding WAV buffer:', error);
		return false;
	}
}

function createTranscriptWorker({ sttBaseUrl, fetchImpl, fsImpl, pathImpl }) {
	const transcriptsMap = new Map();

	async function writeTranscriptHeader(transcriptPath, { transcriptId, channelId, meetingStartIso, participantDisplayNames }) {
		const header = {
			type: 'metadata',
			transcriptId,
			channelId: channelId ?? null,
			meetingStartIso,
			participantDisplayNames: Array.isArray(participantDisplayNames) ? participantDisplayNames : [],
		};
		try {
			await fsImpl.promises.writeFile(transcriptPath, JSON.stringify(header) + '\n', 'utf8');
		} catch (error) {
			console.error('Error writing transcript header:', error);
			throw error;
		}
	}

	async function startTranscript(transcriptId, meetingStartTimeMs) {
		try {
            if (typeof meetingStartTimeMs !== 'number') {
                meetingStartTimeMs = Date.now();
            }
			await fsImpl.promises.mkdir(pathImpl.join(__dirname, 'transcripts'), { recursive: true });
            const meetingStartTimeIso = new Date(meetingStartTimeMs).toISOString();
			const timestamp = meetingStartTimeIso.replace(/[:.]/g, '-');
			const transcriptPath = pathImpl.join(__dirname, 'transcripts', `${transcriptId}_${timestamp}.jsonl`);
			const tempFilePath = pathImpl.join(__dirname, 'transcripts', `${transcriptId}_${timestamp}.jsonl.tmp`);

			transcriptsMap.set(transcriptId, {
				chunksQueue: [],
				processedChunks: [],
				failedChunks: [],
				chunksBucket: new Map(),
				inFlight: false,
				meetingStartIso: meetingStartTimeIso,
				transcriptState: {
					filePath: transcriptPath,
					tmpPath: tempFilePath,
					processedSinceFlush: 0,
					processingPromise: null,
				},
			});
			return transcriptPath;
		} catch (error) {
			console.error('Error starting transcript:', error);
			throw error;
		}
	}

	function ensureProcessing(transcriptId) {
		if (!transcriptsMap.has(transcriptId)) {
			throw new Error('Transcript not found');
		}
		const transcript = transcriptsMap.get(transcriptId);
		if (!transcript.transcriptState.processingPromise) {
			transcript.transcriptState.processingPromise = processNextChunk(transcriptId)
				.finally(() => {
					transcript.transcriptState.processingPromise = null;
				});
		}
		return transcript.transcriptState.processingPromise;
	}

	async function enqueueChunk(transcriptId, chunk) {
		if (!transcriptsMap.has(transcriptId)) {
			throw new Error('Transcript not found');
		}
		const transcript = transcriptsMap.get(transcriptId);
		try {
			if (typeof chunk.chunkId !== 'number') {
				throw new Error('Chunk ID must be a number');
			}
			if (!isValidWav(chunk.audio)) {
				throw new Error('Invalid WAV buffer; must be mono 16kHz PCM');
			}
			if (!chunk.participantData || typeof chunk.participantData !== 'object') {
				throw new Error('Chunk has no participantData');
			}
			chunk.participantId = chunk.participantData.participantId;
			chunk.displayName = chunk.participantData.displayName;
			chunk.segmentBuffer = [];
			chunk.retryCount = 0;
			transcript.chunksQueue.push(chunk);

			if (!transcript.transcriptState.processingPromise) {
				ensureProcessing(transcriptId);
			}
		} catch (error) {
			console.error('Error enqueuing chunk:', error);
			throw error;
		}
	}

	async function appendToTemp(transcriptId) {
		if (!transcriptsMap.has(transcriptId)) {
			throw new Error('Transcript not found');
		}
		const transcript = transcriptsMap.get(transcriptId);
		try {
			const tempPath = transcript.transcriptState.tmpPath;
			for (const chunk of transcript.processedChunks) {
				for (const segment of chunk.segmentBuffer) {
					const JSONLine = {
						transcriptId: transcriptId,
						chunkId: chunk.chunkId,
						participantId: chunk.participantId,
						displayName: chunk.displayName,
                        clockTimeMs: chunk.chunkClockTimeMs != null ?chunk.chunkClockTimeMs + (segment.startMs - chunk.chunkStartTimeMs) : null,
						startMs: segment.startMs,
						endMs: segment.endMs,
						text: segment.text,
					};
					await fsImpl.promises.appendFile(tempPath, JSON.stringify(JSONLine) + '\n');
				}
			}
			transcript.processedChunks = [];
			transcript.transcriptState.processedSinceFlush = 0;
		} catch (error) {
			console.error('Error writing transcript file:', error);
			throw error;
		}
	}

	async function processNextChunk(transcriptId) {
		try {
			if (!transcriptsMap.has(transcriptId)) {
				throw new Error('Transcript not found');
			}
			const transcript = transcriptsMap.get(transcriptId);
			if (transcript.chunksQueue.length === 0) {
				transcript.inFlight = false;
				return;
			}
			transcript.inFlight = true;
			const postUrl = sttBaseUrl + '/transcribe';

			while (transcript.chunksQueue.length > 0) {
				const chunk = transcript.chunksQueue.shift();
				transcript.chunksBucket.set(chunk.chunkId, chunk);
				const audioBuffer = Buffer.from(chunk.audio).toString('base64');

				const response = await fetchImpl(postUrl, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						transcriptId: transcriptId,
						chunkId: chunk.chunkId,
						chunkStartTimeMs: chunk.chunkStartTimeMs,
						audio: audioBuffer,
					}),
				});

				if (response.status !== 200) {
					console.error('Failed to transcribe chunk. Retrying:', response.status, response.statusText);
					chunk.retryCount++;
					if (chunk.retryCount < MAX_RETRIES) {
						transcript.chunksQueue.unshift(chunk);
						transcript.chunksBucket.delete(chunk.chunkId);
						break;
					} else {
						console.error('Failed to transcribe chunk after ' + MAX_RETRIES + ' retries');
						transcript.chunksBucket.delete(chunk.chunkId);
						transcript.failedChunks.push(chunk);
						continue;
					}
				}

				const responseJson = await response.json();
				if (transcript.chunksBucket.has(responseJson.chunkId)) {
					const chunk = transcript.chunksBucket.get(responseJson.chunkId);
					chunk.segmentBuffer.push(...responseJson.segments);
					chunk.audio = null;
					transcript.processedChunks.push(chunk);
					transcript.transcriptState.processedSinceFlush++;
					transcript.chunksBucket.delete(responseJson.chunkId);
				}
				if (transcript.transcriptState.processedSinceFlush >= 5) {
					await appendToTemp(transcriptId);
				}
			}
			if (transcript.processedChunks.length > 0) {
				await appendToTemp(transcriptId);
			}
			transcript.inFlight = false;
		} catch (error) {
			console.error('Error processing next chunk:', error);
			throw error;
		}
	}

	async function closeTranscript(transcriptId, { channelId, participantDisplayNames } = {}) {
		if (!transcriptsMap.has(transcriptId)) {
			throw new Error('Transcript not found');
		}
		const transcript = transcriptsMap.get(transcriptId);
		try {
			// Drain queue: process all remaining chunks and flush to tmp before building final transcript
			while (transcript.chunksQueue.length > 0 || transcript.transcriptState.processingPromise) {
				if (transcript.transcriptState.processingPromise) {
					await transcript.transcriptState.processingPromise;
				} else {
					ensureProcessing(transcriptId);
					if (transcript.transcriptState.processingPromise) {
						await transcript.transcriptState.processingPromise;
					}
				}
			}
			// Flush any remaining processed chunks to tmp
			if (transcript.processedChunks.length > 0) {
				await appendToTemp(transcriptId);
			}
			if (transcript.failedChunks.length > 0) {
				for (const chunk of transcript.failedChunks) {
					chunk.retryCount = 0;
					chunk.segmentBuffer = [];
					transcript.chunksQueue.push(chunk);
				}
				transcript.failedChunks = [];
				await ensureProcessing(transcriptId);
				if (transcript.transcriptState.processingPromise) {
					await transcript.transcriptState.processingPromise;
				}
				if (transcript.processedChunks.length > 0) {
					await appendToTemp(transcriptId);
				}
				if (transcript.failedChunks.length > 0) {
					const failedChunkStartTimes = transcript.failedChunks.map((chunk, i) => `chunk ${i}: ${chunk.chunkStartTimeMs}ms`).join(', ');
					console.error(`${transcript.failedChunks.length} chunks failed to transcribe: ${failedChunkStartTimes}`);
				}
			}
			const transcriptPath = transcript.transcriptState.filePath;
			const tmpPath = transcript.transcriptState.tmpPath;
			await writeTranscriptHeader(transcriptPath, {
				transcriptId,
				channelId: channelId,
				meetingStartIso: transcript.meetingStartIso,
				participantDisplayNames: participantDisplayNames,
			});
			try {
				const segmentContent = await fsImpl.promises.readFile(tmpPath, 'utf8');
				await fsImpl.promises.appendFile(transcriptPath, segmentContent);
				await fsImpl.promises.unlink(tmpPath).catch(() => {});
			} catch (err) {
				if (err.code !== 'ENOENT') throw err;
			}
			transcriptsMap.delete(transcriptId);
			return transcriptPath;
		} catch (error) {
			throw new Error(error.message);
		}
	}

	return {
		startTranscript,
		enqueueChunk,
		closeTranscript,
	};
}

module.exports = { createTranscriptWorker };
