const { MessageFlags } = require('discord.js');
const startCommand = require('../../../commands/utility/start.js');

function createMockInteraction(overrides = {}) {
	const reply = jest.fn().mockResolvedValue(undefined);
	const sessionStore = {
		guildHasSession: jest.fn().mockReturnValue(false),
	};
	const meetingController = {
		startMeeting: jest.fn().mockResolvedValue(undefined),
	};
	const interaction = {
		member: { voice: { channel: { id: 'voice-123' } } },
		guild: { id: 'guild-123' },
		client: { sessionStore, meetingController },
		reply,
		...overrides,
	};
	return { interaction, reply, sessionStore, meetingController };
}

describe('/start', () => {
	it('replies with "Must be connected to a voice channel"', async () => {
		const { interaction, reply, meetingController } = createMockInteraction({
			member: { voice: { channel: null } },
		});

		await startCommand.execute(interaction);

		expect(reply).toHaveBeenCalledTimes(1);
		expect(reply).toHaveBeenCalledWith({
			content: 'Must be connected to a voice channel',
			flags: MessageFlags.Ephemeral,
		});
		expect(meetingController.startMeeting).not.toHaveBeenCalled();
	});

	it('replies with "A meeting is already in progress" and does not call controller when guild has a session', async () => {
		const { interaction, reply, sessionStore, meetingController } = createMockInteraction();
		sessionStore.guildHasSession.mockReturnValue(true);

		await startCommand.execute(interaction);

		expect(reply).toHaveBeenCalledTimes(1);
		expect(reply).toHaveBeenCalledWith({
			content: 'A meeting is already in progress in this server.',
			flags: MessageFlags.Ephemeral,
		});
		expect(meetingController.startMeeting).not.toHaveBeenCalled();
	});

	it('calls meetingController.startMeeting with interaction when in voice channel and no session', async () => {
		const { interaction, reply, meetingController } = createMockInteraction();

		await startCommand.execute(interaction);

		expect(meetingController.startMeeting).toHaveBeenCalledTimes(1);
		expect(meetingController.startMeeting).toHaveBeenCalledWith(interaction);
		expect(reply).not.toHaveBeenCalled();
	});
});
