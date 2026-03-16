require('dotenv').config();

//Worker config
//Max retries for sending chunks to STT
const WORKER_MAX_RETRIES = 3;
//Number of chunks to process before flushing the transcript
const FLUSH_AFTER_PROCESSED_CHUNKS = 5;
//Timeout for each STT request
const DEFAULT_STT_TIMEOUT_MS = 5000;
//Timeout for the STT wrapper to be ready
const DEFAULT_STT_READY_TIMEOUT_MS = 120000;
//Time interval between each GET /health attempt while waiting for the STT wrapper to be ready
const DEFAULT_STT_READY_POLL_MS = 2000;

//Manager config
//Max retries for enqueuing chunks to the worker
const MANAGER_MAX_RETRIES = 3;
//Timeout for the LLM to generate a summary
const DEFAULT_LLM_TIMEOUT_MS = 20000;

function getInt(name, fallback) {
    const raw = process.env[name];
    const parsed = raw != null ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

function getBoolean(name, fallback) {
    const raw = process.env[name];
    const parsed = raw != null ? raw.toLowerCase().trim() === 'true' : fallback;
    return parsed;
  }

const workerPort = getInt('WORKER_PORT', 3000);
const sttBaseUrl = typeof process.env.STT_BASE_URL === 'string' ? process.env.STT_BASE_URL : 'http://localhost:8000';
const workerBaseUrl = typeof process.env.WORKER_BASE_URL === 'string' ? process.env.WORKER_BASE_URL : 'http://localhost:3000';

module.exports = {
    //Worker config
    workerConfig: {
        localWorker: getBoolean('WORKER_USE_LOCAL', true),
        workerPort,
        workerBaseUrl,
        sttBaseUrl,
        workerTimeouts: {
            //Max retries for sending chunks to STT
            maxRetries: WORKER_MAX_RETRIES,
            //Number of chunks to process before flushing the transcript
            flushAfterProcessedChunks: FLUSH_AFTER_PROCESSED_CHUNKS,
            //Timeout for each STT request
            sttTimeoutMs: getInt('STT_TIMEOUT_MS',  DEFAULT_STT_TIMEOUT_MS),
            //Timeout for the STT wrapper to be ready
            sttReadyTimeoutMs: getInt('STT_READY_TIMEOUT_MS', DEFAULT_STT_READY_TIMEOUT_MS),
            //Time interval between each GET /health attempt while waiting for the STT wrapper to be ready
            sttReadyPollMs: getInt('STT_READY_POLL_MS', DEFAULT_STT_READY_POLL_MS),
        },
    },
    managerConfig: {
        //Max retries for enqueuing chunks to the worker
        maxRetries: MANAGER_MAX_RETRIES,
    },
    //Timeouts
    coordinatorConfig: {
        meetingTimeouts: {
            //Timeout for explicitly pausing the meeting
            explicitPauseMs: 30 * 60 * 1000,
            //Timeout for paused empty room
            pausedEmptyRoomMs: 15 * 60 * 1000,
            //Timeout for empty room
            emptyRoomMs: 5 * 60 * 1000,
            //Timeout for aceepting the disclaimer and close-confirm buttons
            uiTimeoutMs: 60 * 1000,
            },
    },
    //Timeout for the LLM to generate a summary
    llmTimeoutMs: getInt('LLM_TIMEOUT_MS', DEFAULT_LLM_TIMEOUT_MS)
};
