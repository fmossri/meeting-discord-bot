const { Events } = require('discord.js');

const LATE_JOINER_DM =
	'A meeting with recording is in progress in this channel. To join as a participant, click **Accept** on the disclaimer message in the channel. To decline being recorded, click **Reject**.';

module.exports = {
	name: Events.VoiceStateUpdate,
	async execute(oldState, newState, client) {
		if (!newState.channelId) {
			return;
		}
		const sessionJoined = client.sessionStore.getSessionByChannelId(newState.channelId);
		if (!sessionJoined) return;
		const userId = newState.id;

		if (!sessionJoined.sessionState.participantIds.includes(userId)) {
			const user = newState.member?.user ?? (await client.users.fetch(userId).catch(() => null));
			if (user) {
				await user.send(LATE_JOINER_DM).catch((err) => {
					console.error('Could not DM late joiner:', err.message);
				});
			}
			return;
		}

		client.botCoordinator.reconnectParticipant(sessionJoined.sessionId, userId);
	},
};