const { MessageFlags } = require('discord.js');
const resumeCommand = require('../../../commands/utility/resume.js');

function createMockInteraction(overrides = {}) {
	const reply = jest.fn().mockResolvedValue(undefined);
	const deferReply = jest.fn().mockResolvedValue(undefined);
	const deleteReply = jest.fn().mockResolvedValue(undefined);
	const editReply = jest.fn().mockResolvedValue(undefined);
	const sessionStore = {
		channelHasSession: jest.fn().mockReturnValue(false),
		getSessionByChannelId: jest.fn().mockReturnValue(null),
	};
	const meetingController = {
		resumeMeeting: jest.fn().mockResolvedValue(true),
	};
	const interaction = {
		member: { user: { id: 'user-1' }, voice: { channel: { id: 'voice-123' } } },
		client: { sessionStore, meetingController },
		reply,
		deferReply,
		deleteReply,
		editReply,
		...overrides,
	};
	return { interaction, reply, deferReply, deleteReply, editReply, sessionStore, meetingController };
}

describe('/resume', () => {
	it('replies with "Must be connected" when member has no voice channel', async () => {
		const { interaction, reply, meetingController } = createMockInteraction({
			member: { user: { id: 'user-1' }, voice: { channel: null } },
		});

		await resumeCommand.execute(interaction);

		expect(reply).toHaveBeenCalledWith({
			content: "Must be connected to the meeting's voice channel.",
			flags: MessageFlags.Ephemeral,
		});
		expect(meetingController.resumeMeeting).not.toHaveBeenCalled();
	});

	it('replies with "No meeting is in progress" when channel has no session', async () => {
		const { interaction, reply, sessionStore, meetingController } = createMockInteraction();
		sessionStore.channelHasSession.mockReturnValue(false);

		await resumeCommand.execute(interaction);

		expect(reply).toHaveBeenCalledWith({
			content: 'No meeting is in progress in this channel.',
			flags: MessageFlags.Ephemeral,
		});
		expect(meetingController.resumeMeeting).not.toHaveBeenCalled();
	});

	it('replies with "You are not a participant" when user not in participantIds', async () => {
		const { interaction, reply, sessionStore, meetingController } = createMockInteraction();
		sessionStore.channelHasSession.mockReturnValue(true);
		sessionStore.getSessionByChannelId.mockReturnValue({
			sessionId: 'session-1',
			sessionState: { participantIds: ['other-user'], started: true, paused: true },
		});

		await resumeCommand.execute(interaction);

		expect(reply).toHaveBeenCalledWith({
			content: 'You are not a participant in this meeting.',
			flags: MessageFlags.Ephemeral,
		});
		expect(meetingController.resumeMeeting).not.toHaveBeenCalled();
	});

	it('replies with "Meeting recording is not paused" when not started or not paused', async () => {
		const { interaction, reply, sessionStore, meetingController } = createMockInteraction();
		sessionStore.channelHasSession.mockReturnValue(true);
		sessionStore.getSessionByChannelId.mockReturnValue({
			sessionId: 'session-1',
			sessionState: { participantIds: ['user-1'], started: true, paused: false },
		});

		await resumeCommand.execute(interaction);

		expect(reply).toHaveBeenCalledWith({
			content: 'Meeting recording is not paused.',
			flags: MessageFlags.Ephemeral,
		});
		expect(meetingController.resumeMeeting).not.toHaveBeenCalled();
	});

	it('deferReply, calls resumeMeeting(sessionId), deleteReply when resumeMeeting returns true', async () => {
		const { interaction, reply, deferReply, deleteReply, editReply, sessionStore, meetingController } = createMockInteraction();
		sessionStore.channelHasSession.mockReturnValue(true);
		sessionStore.getSessionByChannelId.mockReturnValue({
			sessionId: 'session-1',
			sessionState: { participantIds: ['user-1'], started: true, paused: true },
		});
		meetingController.resumeMeeting.mockResolvedValue(true);

		await resumeCommand.execute(interaction);

		expect(deferReply).toHaveBeenCalledTimes(1);
		expect(meetingController.resumeMeeting).toHaveBeenCalledWith('session-1');
		expect(deleteReply).toHaveBeenCalledTimes(1);
		expect(editReply).not.toHaveBeenCalled();
		expect(reply).not.toHaveBeenCalled();
	});

	it('deferReply, editReply with failure message when resumeMeeting returns false', async () => {
		const { interaction, reply, deferReply, deleteReply, editReply, sessionStore, meetingController } = createMockInteraction();
		sessionStore.channelHasSession.mockReturnValue(true);
		sessionStore.getSessionByChannelId.mockReturnValue({
			sessionId: 'session-1',
			sessionState: { participantIds: ['user-1'], started: true, paused: true },
		});
		meetingController.resumeMeeting.mockResolvedValue(false);

		await resumeCommand.execute(interaction);

		expect(deferReply).toHaveBeenCalledTimes(1);
		expect(meetingController.resumeMeeting).toHaveBeenCalledWith('session-1');
		expect(editReply).toHaveBeenCalledWith({
			content: 'Failed to resume the meeting recording.',
			flags: MessageFlags.Ephemeral,
		});
		expect(deleteReply).not.toHaveBeenCalled();
	});
});
