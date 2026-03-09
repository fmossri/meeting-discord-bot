const voiceStateUpdate = require('../../events/voiceStateUpdate.js');

const LATE_JOINER_DM =
	'A meeting with recording is in progress in this channel. To join as a participant, click **Accept** on the disclaimer message in the channel. To decline being recorded, click **Reject**.';

function createMockClient(overrides = {}) {
	return {
		sessionStore: {
			getSessionByChannelId: jest.fn().mockReturnValue(null),
		},
		botCoordinator: {
			reconnectParticipant: jest.fn(),
		},
		users: {
			fetch: jest.fn().mockRejectedValue(new Error('User not found')),
		},
		...overrides,
	};
}

function createMockNewState(overrides = {}) {
	return {
		channelId: 'channel-123',
		id: 'user-456',
		member: null,
		...overrides,
	};
}

describe('VoiceStateUpdate', () => {
	it('does nothing when newState.channelId is null (user left)', async () => {
		const getSessionByChannelId = jest.fn();
		const reconnectParticipant = jest.fn();
		const client = createMockClient({
			sessionStore: { getSessionByChannelId },
			botCoordinator: { reconnectParticipant },
		});
		const newState = createMockNewState({ channelId: null });

		await voiceStateUpdate.execute({}, newState, client);

		expect(getSessionByChannelId).not.toHaveBeenCalled();
		expect(reconnectParticipant).not.toHaveBeenCalled();
	});

	it('does nothing when channel has no session', async () => {
		const getSessionByChannelId = jest.fn().mockReturnValue(null);
		const reconnectParticipant = jest.fn();
		const client = createMockClient({
			sessionStore: { getSessionByChannelId },
			botCoordinator: { reconnectParticipant },
		});
		const newState = createMockNewState();

		await voiceStateUpdate.execute({}, newState, client);

		expect(getSessionByChannelId).toHaveBeenCalledWith('channel-123');
		expect(reconnectParticipant).not.toHaveBeenCalled();
	});

	it('sends late-joiner DM and does not call reconnectParticipant when user is not in participantIds', async () => {
		const send = jest.fn().mockResolvedValue(undefined);
		const getSessionByChannelId = jest.fn().mockReturnValue({
			sessionId: 'session-1',
			sessionState: { participantIds: ['other-user'], rejectedIds: [], dmIds: [], started: true },
		});
		const reconnectParticipant = jest.fn();
		const client = createMockClient({
			sessionStore: { getSessionByChannelId },
			botCoordinator: { reconnectParticipant },
		});
		const newState = createMockNewState({
			id: 'late-joiner',
			member: { user: { send } },
		});

		await voiceStateUpdate.execute({}, newState, client);

		expect(send).toHaveBeenCalledTimes(1);
		expect(send).toHaveBeenCalledWith(LATE_JOINER_DM);
		expect(reconnectParticipant).not.toHaveBeenCalled();
	});

	it('does not throw when late joiner has no member and users.fetch fails', async () => {
		const getSessionByChannelId = jest.fn().mockReturnValue({
			sessionId: 'session-1',
			sessionState: { participantIds: ['other-user'], rejectedIds: [], dmIds: [], started: true },
		});
		const reconnectParticipant = jest.fn();
		const client = createMockClient({
			sessionStore: { getSessionByChannelId },
			botCoordinator: { reconnectParticipant },
			users: { fetch: jest.fn().mockResolvedValue(null) },
		});
		const newState = createMockNewState({ id: 'late-joiner', member: null });

		await expect(voiceStateUpdate.execute({}, newState, client)).resolves.not.toThrow();
		expect(reconnectParticipant).not.toHaveBeenCalled();
	});

	it('calls reconnectParticipant when user is in participantIds', async () => {
		const getSessionByChannelId = jest.fn().mockReturnValue({
			sessionId: 'session-1',
			sessionState: { participantIds: ['user-456'], rejectedIds: [], dmIds: [], started: true, paused: false },
		});
		const reconnectParticipant = jest.fn();
		const client = createMockClient({
			sessionStore: { getSessionByChannelId },
			botCoordinator: { reconnectParticipant },
		});
		const newState = createMockNewState({ id: 'user-456' });

		await voiceStateUpdate.execute({}, newState, client);

		expect(reconnectParticipant).toHaveBeenCalledTimes(1);
		expect(reconnectParticipant).toHaveBeenCalledWith('session-1', 'user-456');
	});

	it('does nothing when user stays in the same channel (mute/unmute etc.)', async () => {
		const getSessionByChannelId = jest.fn().mockReturnValue({
			sessionId: 'session-1',
			sessionState: { participantIds: [], rejectedIds: [], dmIds: [] },
		});
		const reconnectParticipant = jest.fn();
		const client = createMockClient({
			sessionStore: { getSessionByChannelId },
			botCoordinator: { reconnectParticipant },
		});
		const oldState = createMockNewState({ channelId: 'channel-123' });
		const newState = createMockNewState({ channelId: 'channel-123' });

		await voiceStateUpdate.execute(oldState, newState, client);

		expect(getSessionByChannelId).not.toHaveBeenCalled();
		expect(reconnectParticipant).not.toHaveBeenCalled();
	});
});
