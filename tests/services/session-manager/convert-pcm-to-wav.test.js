const wav = require('node-wav');
const { convertPCMToWav } = require('../../../utils/convert-pcm-to-wav.js');

describe('convertPCMToWav', () => {
    function makePCMBuffer(int16Samples) {
        const buf = Buffer.alloc(int16Samples.length * 2);
        int16Samples.forEach((val, i) => buf.writeInt16LE(val, i * 2));
        return buf;
    }

    it('returns a WAV buffer with the given sample rate', () => {
        const pcm = makePCMBuffer([0, 0]);
        const result = convertPCMToWav(pcm, 16000);
        expect(Buffer.isBuffer(result)).toBe(true);
        const decoded = wav.decode(result);
        expect(decoded.sampleRate).toBe(16000);
        expect(decoded.channelData.length).toBe(1);
        expect(decoded.channelData[0].length).toBe(2);
    });

    it('converts 16-bit PCM to float samples in [-1, 1]', () => {
        const pcm = makePCMBuffer([0, 32767, -32768]);
        const result = convertPCMToWav(pcm, 16000);
        const decoded = wav.decode(result);
        const floats = decoded.channelData[0];
        expect(floats[0]).toBe(0);
        expect(floats[1]).toBeCloseTo(1, 2);
        expect(floats[2]).toBeCloseTo(-1, 2);
    });

    it('accepts different sample rates', () => {
        const pcm = makePCMBuffer([0]);
        const result = convertPCMToWav(pcm, 44100);
        const decoded = wav.decode(result);
        expect(decoded.sampleRate).toBe(44100);
    });
});
