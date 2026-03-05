const sessions = new Map();

const sessionStore = {

	createSession(sessionId, sessionData) {
		sessions.set(sessionId, sessionData);
		console.log('debug message: session created!');
	},
	findSessionByChannelId(channelId) {
		for (const [sessionId, sessionData] of sessions.entries()) {
			if (sessionData.voiceChannelId === channelId) {
				return { sessionId, sessionData };
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
