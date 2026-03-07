const { MessageFlags } = require('discord.js');
const startCommand = require('../../../commands/utility/start.js');

function createMockInteraction(overrides = {}) {
	const reply = jest.fn().mockResolvedValue(undefined);
	const sessionStore = {
		channelHasSession: jest.fn().mockReturnValue(false),
	};
	const botCoordinator = {
		startMeeting: jest.fn().mockResolvedValue(undefined),
	};
	const interaction = {
		member: { voice: { channel: { id: 'voice-123' } } },
		client: { sessionStore, botCoordinator },
		reply,
		...overrides,
	};
	return { interaction, reply, sessionStore, botCoordinator };
}

describe('/start', () => {
	it('replies with "Must be connected to a voice channel"', async () => {
		const { interaction, reply, botCoordinator } = createMockInteraction({
			member: { voice: { channel: null } },
		});

		await startCommand.execute(interaction);

		expect(reply).toHaveBeenCalledTimes(1);
		expect(reply).toHaveBeenCalledWith({
			content: 'Must be connected to a voice channel',
			flags: MessageFlags.Ephemeral,
		});
		expect(botCoordinator.startMeeting).not.toHaveBeenCalled();
	});

	it('replies with "A session is already in progress" and does not call coordinator when channel has a session', async () => {
		const { interaction, reply, sessionStore, botCoordinator } = createMockInteraction();
		sessionStore.channelHasSession.mockReturnValue(true);

		await startCommand.execute(interaction);

		expect(reply).toHaveBeenCalledTimes(1);
		expect(reply).toHaveBeenCalledWith({
			content: 'A session is already in progress in this channel',
			flags: MessageFlags.Ephemeral,
		});
		expect(botCoordinator.startMeeting).not.toHaveBeenCalled();
	});

	it('calls botCoordinator.startMeeting with interaction when in voice channel and no session', async () => {
		const { interaction, reply, botCoordinator } = createMockInteraction();

		await startCommand.execute(interaction);

		expect(botCoordinator.startMeeting).toHaveBeenCalledTimes(1);
		expect(botCoordinator.startMeeting).toHaveBeenCalledWith(interaction);
		expect(reply).not.toHaveBeenCalled();
	});
});
