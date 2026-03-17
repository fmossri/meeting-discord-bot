const sessions = new Map();

const sessionStore = {

	createSession(sessionId, sessionState) {
		sessions.set(sessionId, sessionState);
	},
	findSessionByChannelId(channelId) {
		for (const [sessionId, sessionState] of sessions.entries()) {
			if (sessionState.voiceChannelId === channelId) {
				return { sessionId, sessionState };
			}
		}
		return null;
	},

	findSessionByGuildId(guildId) {
		for (const [sessionId, sessionState] of sessions.entries()) {
			if (sessionState.guildId === guildId) {
				return { sessionId, sessionState };
			}
		}
		return null;
	},

	getSessionById(sessionId) {
		return sessions.get(sessionId);
	},

	getSessionByChannelId(channelId) {
		return this.findSessionByChannelId(channelId);
	},
	deleteSession(sessionId) {
		if (!sessions.has(sessionId)) {
			return;
		}
		sessions.delete(sessionId);
	},

	channelHasSession(channelId) {
		return this.findSessionByChannelId(channelId) !== null;
	},

	guildHasSession(guildId) {
		return this.findSessionByGuildId(guildId) !== null;
	},

	clearSessions() {
		sessions.clear();
	},
};

module.exports = {
	sessionStore,
};
