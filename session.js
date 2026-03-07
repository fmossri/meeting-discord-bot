const sessions = new Map();

const sessionStore = {

	createSession(sessionId, sessionState) {
		sessions.set(sessionId, sessionState);
		console.log('debug message: session created!');
	},
	findSessionByChannelId(channelId) {
		for (const [sessionId, sessionState] of sessions.entries()) {
			if (sessionState.voiceChannelId === channelId) {
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
			console.log('no session found by message id.', sessionId);
			return;
		}
		sessions.delete(sessionId);
		console.log('session deleted by message id.', sessionId);
	},

	channelHasSession(channelId) {
		return this.findSessionByChannelId(channelId) !== null;
	},

	clearSessions() {
		sessions.clear();
	},
};

module.exports = {
	sessionStore,
};
