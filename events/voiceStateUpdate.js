const { Events } = require('discord.js');

const LATE_JOINER_DM =
	'A meeting with recording is in progress in this channel. To join as a participant, click **Accept** on the disclaimer message in the channel. To decline being recorded, click **Reject**.';

module.exports = {
	name: Events.VoiceStateUpdate,
	async execute(oldState, newState, client) {
		// Ignore leaves (handled elsewhere) and non-channel changes like mute/unmute
		if (!newState.channelId || oldState.channelId === newState.channelId) {
			return;
		}

		const sessionJoined = client.sessionStore.getSessionByChannelId(newState.channelId);
		if (!sessionJoined) return;

		const userId = newState.id;
		const { participantIds, dmIds, started } = sessionJoined.sessionState;

		// First time we see this user in the meeting channel: send late-joiner DM once
		if (!participantIds.includes(userId) && !dmIds.includes(userId) && started) {
			const user = newState.member?.user ?? (await client.users.fetch(userId).catch(() => null));
			if (user) {
				await user.send(LATE_JOINER_DM).catch((err) => {
					console.error('Could not DM late joiner:', err.message);
				});
				dmIds.push(userId);
			}
			return;
		}

		// User already known to the session: if they are a participant, reconnect them
		if (participantIds.includes(userId)) {
			client.botCoordinator.reconnectParticipant(sessionJoined.sessionId, userId);
		}
	},
};