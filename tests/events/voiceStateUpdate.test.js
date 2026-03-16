const voiceStateUpdate = require('../../events/voiceStateUpdate.js');

function createMockClient(overrides = {}) {
	return {
		sessionStore: {
			getSessionByChannelId: jest.fn().mockReturnValue(null),
		},
		meetingController: {
			handleUserJoinedMeetingChannel: jest.fn().mockResolvedValue(undefined),
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
		const handleUserJoinedMeetingChannel = jest.fn();
		const client = createMockClient({
			sessionStore: { getSessionByChannelId },
			meetingController: { handleUserJoinedMeetingChannel },
		});
		const newState = createMockNewState({ channelId: null });

		await voiceStateUpdate.execute({}, newState, client);

		expect(getSessionByChannelId).not.toHaveBeenCalled();
		expect(handleUserJoinedMeetingChannel).not.toHaveBeenCalled();
	});

	it('does nothing when channel has no session', async () => {
		const getSessionByChannelId = jest.fn().mockReturnValue(null);
		const handleUserJoinedMeetingChannel = jest.fn();
		const client = createMockClient({
			sessionStore: { getSessionByChannelId },
			meetingController: { handleUserJoinedMeetingChannel },
		});
		const newState = createMockNewState();

		await voiceStateUpdate.execute({}, newState, client);

		expect(getSessionByChannelId).toHaveBeenCalledWith('channel-123');
		expect(handleUserJoinedMeetingChannel).not.toHaveBeenCalled();
	});

	it('calls handleUserJoinedMeetingChannel when user joins meeting channel (late joiner path)', async () => {
		const mockUser = { send: jest.fn().mockResolvedValue(undefined) };
		const getSessionByChannelId = jest.fn().mockReturnValue({
			sessionId: 'session-1',
			sessionState: { participantIds: ['other-user'], rejectedIds: [], dmIds: [], started: true },
		});
		const handleUserJoinedMeetingChannel = jest.fn().mockResolvedValue(undefined);
		const client = createMockClient({
			sessionStore: { getSessionByChannelId },
			meetingController: { handleUserJoinedMeetingChannel },
		});
		const newState = createMockNewState({
			id: 'late-joiner',
			member: { user: mockUser },
		});

		await voiceStateUpdate.execute({}, newState, client);

		expect(handleUserJoinedMeetingChannel).toHaveBeenCalledTimes(1);
		expect(handleUserJoinedMeetingChannel).toHaveBeenCalledWith('session-1', 'late-joiner', { user: mockUser });
	});

	it('does not throw when late joiner has no member and users.fetch returns null', async () => {
		const getSessionByChannelId = jest.fn().mockReturnValue({
			sessionId: 'session-1',
			sessionState: { participantIds: ['other-user'], rejectedIds: [], dmIds: [], started: true },
		});
		const handleUserJoinedMeetingChannel = jest.fn().mockResolvedValue(undefined);
		const client = createMockClient({
			sessionStore: { getSessionByChannelId },
			meetingController: { handleUserJoinedMeetingChannel },
			users: { fetch: jest.fn().mockResolvedValue(null) },
		});
		const newState = createMockNewState({ id: 'late-joiner', member: null });

		await expect(voiceStateUpdate.execute({}, newState, client)).resolves.not.toThrow();
		expect(handleUserJoinedMeetingChannel).toHaveBeenCalledWith('session-1', 'late-joiner', { user: null });
	});

	it('calls handleUserJoinedMeetingChannel when user is in participantIds', async () => {
		const mockUser = {};
		const getSessionByChannelId = jest.fn().mockReturnValue({
			sessionId: 'session-1',
			sessionState: { participantIds: ['user-456'], rejectedIds: [], dmIds: [], started: true, paused: false },
		});
		const handleUserJoinedMeetingChannel = jest.fn().mockResolvedValue(undefined);
		const client = createMockClient({
			sessionStore: { getSessionByChannelId },
			meetingController: { handleUserJoinedMeetingChannel },
			users: { fetch: jest.fn().mockResolvedValue(mockUser) },
		});
		const newState = createMockNewState({ id: 'user-456', member: null });

		await voiceStateUpdate.execute({}, newState, client);

		expect(handleUserJoinedMeetingChannel).toHaveBeenCalledTimes(1);
		expect(handleUserJoinedMeetingChannel).toHaveBeenCalledWith('session-1', 'user-456', { user: mockUser });
	});

	it('does nothing when user stays in the same channel (mute/unmute etc.)', async () => {
		const getSessionByChannelId = jest.fn();
		const handleUserJoinedMeetingChannel = jest.fn();
		const client = createMockClient({
			sessionStore: { getSessionByChannelId },
			meetingController: { handleUserJoinedMeetingChannel },
		});
		const oldState = createMockNewState({ channelId: 'channel-123' });
		const newState = createMockNewState({ channelId: 'channel-123' });

		await voiceStateUpdate.execute(oldState, newState, client);

		expect(getSessionByChannelId).not.toHaveBeenCalled();
		expect(handleUserJoinedMeetingChannel).not.toHaveBeenCalled();
	});
});
