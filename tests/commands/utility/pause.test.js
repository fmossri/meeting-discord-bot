const { MessageFlags } = require('discord.js');
const pauseCommand = require('../../../commands/utility/pause.js');

function createMockInteraction(overrides = {}) {
	const reply = jest.fn().mockResolvedValue(undefined);
	const deferReply = jest.fn().mockResolvedValue(undefined);
	const deleteReply = jest.fn().mockResolvedValue(undefined);
	const sessionStore = {
		channelHasSession: jest.fn().mockReturnValue(false),
		getSessionByChannelId: jest.fn().mockReturnValue(null),
	};
	const meetingController = {
		pauseMeeting: jest.fn().mockResolvedValue(undefined),
	};
	const interaction = {
		member: { user: { id: 'user-1' }, voice: { channel: { id: 'voice-123' } } },
		client: { sessionStore, meetingController },
		reply,
		deferReply,
		deleteReply,
		...overrides,
	};
	return { interaction, reply, deferReply, deleteReply, sessionStore, meetingController };
}

describe('/pause', () => {
	it('replies with "Must be connected to a voice channel" when member has no voice channel', async () => {
		const { interaction, reply, meetingController } = createMockInteraction({
			member: { user: { id: 'user-1' }, voice: { channel: null } },
		});

		await pauseCommand.execute(interaction);

		expect(reply).toHaveBeenCalledTimes(1);
		expect(reply).toHaveBeenCalledWith({
			content: 'Must be connected to a voice channel.',
			flags: MessageFlags.Ephemeral,
		});
		expect(meetingController.pauseMeeting).not.toHaveBeenCalled();
	});

	it('replies with "No meeting is in progress in this channel" when channel has no session', async () => {
		const { interaction, reply, sessionStore, meetingController } = createMockInteraction();
		sessionStore.channelHasSession.mockReturnValue(false);

		await pauseCommand.execute(interaction);

		expect(reply).toHaveBeenCalledWith({
			content: 'No meeting is in progress in this channel.',
			flags: MessageFlags.Ephemeral,
		});
		expect(meetingController.pauseMeeting).not.toHaveBeenCalled();
	});

	it('replies with "You are not a participant" when user not in participantIds', async () => {
		const { interaction, reply, sessionStore, meetingController } = createMockInteraction();
		sessionStore.channelHasSession.mockReturnValue(true);
		sessionStore.getSessionByChannelId.mockReturnValue({
			sessionId: 'session-1',
			sessionState: { participantIds: ['other-user'], started: true, paused: false },
		});

		await pauseCommand.execute(interaction);

		expect(reply).toHaveBeenCalledWith({
			content: 'You are not a participant in this meeting.',
			flags: MessageFlags.Ephemeral,
		});
		expect(meetingController.pauseMeeting).not.toHaveBeenCalled();
	});

	it('replies with "Meeting recording is not in progress" when not started or already paused', async () => {
		const { interaction, reply, sessionStore, meetingController } = createMockInteraction();
		sessionStore.channelHasSession.mockReturnValue(true);
		sessionStore.getSessionByChannelId.mockReturnValue({
			sessionId: 'session-1',
			sessionState: { participantIds: ['user-1'], started: false, paused: false },
		});

		await pauseCommand.execute(interaction);

		expect(reply).toHaveBeenCalledWith({
			content: 'Meeting recording is not in progress.',
			flags: MessageFlags.Ephemeral,
		});
		expect(meetingController.pauseMeeting).not.toHaveBeenCalled();
	});

	it('deferReply, calls pauseMeeting(sessionId), deleteReply when started and not paused', async () => {
		const { interaction, reply, deferReply, deleteReply, sessionStore, meetingController } = createMockInteraction();
		sessionStore.channelHasSession.mockReturnValue(true);
		sessionStore.getSessionByChannelId.mockReturnValue({
			sessionId: 'session-1',
			sessionState: { participantIds: ['user-1'], started: true, paused: false },
		});

		await pauseCommand.execute(interaction);

		expect(deferReply).toHaveBeenCalledTimes(1);
		expect(meetingController.pauseMeeting).toHaveBeenCalledTimes(1);
		expect(meetingController.pauseMeeting).toHaveBeenCalledWith('session-1');
		expect(deleteReply).toHaveBeenCalledTimes(1);
		expect(reply).not.toHaveBeenCalled();
	});
});
