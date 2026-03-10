const wav = require('node-wav');

/**
 * Creates a valid 16 kHz mono WAV buffer for testing.
 * @param {number} [sampleCount=48000] - Number of samples (3 seconds at 16 kHz by default).
 * @returns {Buffer} A WAV buffer that passes isValidWav (16 kHz, mono).
 */
function createValidWavBuffer(sampleCount = 48000) {
    const samples = new Float32Array(sampleCount).fill(0);
    return Buffer.from(wav.encode([samples], { sampleRate: 16000, bitDepth: 16 }));
}


function createChunk(overrides = {}) {
    return {
        chunkId: 1,
        chunkStartTimeMs: 0,
        participantData: { participantId: 'user-123', displayName: 'Alice' },
        audio: createValidWavBuffer(),
        ...overrides,
    };
}
module.exports = { createValidWavBuffer, createChunk };
