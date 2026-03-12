const DEFAULT_STT_TIMEOUT_MS = 5000;
const DEFAULT_LLM_TIMEOUT_MS = 20000;

function getInt(name, fallback) {
    const raw = process.env[name];
    const parsed = raw != null ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

module.exports = {
    sttTimeoutMs: getInt('STT_TIMEOUT_MS',  DEFAULT_STT_TIMEOUT_MS),
    llmTimeoutMs: getInt('LLM_TIMEOUT_MS', DEFAULT_LLM_TIMEOUT_MS),
    meetingTimeouts: {explicitPauseMs: 30 * 60 * 1000,
        pausedEmptyRoomMs: 15 * 60 * 1000,
        emptyRoomMs: 5 * 60 * 1000,
        uiTimeoutMs: 60 * 1000,
        },
};
