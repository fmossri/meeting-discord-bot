const { Events } = require('discord.js');
const timeoutDuration = require('../config/timeouts');

const LATE_JOINER_DM =
	'A meeting with recording is in progress in this channel. To join as a participant, click **Accept** on the disclaimer message in the channel. To decline being recorded, click **Reject**.';

module.exports = {
	name: Events.VoiceStateUpdate,
	async execute(oldState, newState, client) {
		// Ignore non-channel changes like mute/unmute
        if (oldState.channelId === newState.channelId) {
            return;
        }

        const oldSession = oldState.channelId
        ? client.sessionStore.getSessionByChannelId(oldState.channelId)
        : null;

        // User left the meeting channel (to null OR another channel)
        if (oldSession && oldState.channelId !== newState.channelId) {
            const sessionState = oldSession.sessionState;
            // Channel not cached or user left before the meeting started -> do nothing.
            if (!oldState.channel || !sessionState.started) return;
            const membersInChannel = oldState.channel.members;
            // Check if there are any participants in the meeting's voice channel.
            for (const member of membersInChannel) {
                // A participant is still in the channel -> do nothing.
                if (sessionState.participantIds.includes(member.user.id)) {
                    return;
                }
            }

            // Room empties and not paused -> pause meeting and auto-close after emptyRoomMs timeout
            try {
                if (!sessionState.paused) {
                    await client.botCoordinator.pauseMeeting(oldSession.sessionId);
                    clearTimeout(sessionState.timeouts.pauseTimeoutId);
                    sessionState.timeouts.pauseTimeoutId = setTimeout(async () => {
                        await client.botCoordinator.autoCloseMeeting(oldSession.sessionId);
                    }, timeoutDuration.emptyRoomMs);

                // Room empties and paused -> auto-close after pausedEmptyRoomMs timeout
                } else {
                    clearTimeout(sessionState.timeouts.pauseTimeoutId);
                    sessionState.timeouts.pauseTimeoutId = setTimeout(async () => {
                        await client.botCoordinator.autoCloseMeeting(oldSession.sessionId);
                    }, timeoutDuration.pausedEmptyRoomMs);
                }
                return;
            } catch (error) {
                console.error('error pausing meeting.', error);
                return;
            }
          }

        // User joined the meeting channel (to null OR another channel)
        const newSession = newState.channelId
        ? client.sessionStore.getSessionByChannelId(newState.channelId)
        : null;
        // Not our meeting channel or not started -> do nothing.
        if (!newSession || !newSession.sessionState.started) {
            return;
          }
          const sessionState = newSession.sessionState;
          const userId = newState.id;

        // User is a participant
        if (sessionState.participantIds.includes(userId)) {
            // Not paused, user is a participant -> reconnect
            if (!sessionState.paused) {
                await client.botCoordinator.reconnectParticipant(newSession.sessionId, userId);
                return;
            // Paused, user is a participant -> resets pause timeout to explicitPauseMs timeout and auto-closes after explicitPauseMs timeout
            } else {
                clearTimeout(sessionState.timeouts.pauseTimeoutId);
                sessionState.timeouts.pauseTimeoutId = setTimeout(async () => {
                    await client.botCoordinator.autoCloseMeeting(newSession.sessionId);
                }, timeoutDuration.explicitPauseMs);
            }
            return;
        }
        // User has explicitly rejected earlier -> do nothing.
        if (sessionState.rejectedIds.includes(userId)) {
            return;
        
        }
        // Meeting started, user is not a participant and hasn't rejected or been sent a DM yet -> send late joiner DM
        if (sessionState.started && !sessionState.dmIds.includes(userId)) {
            const user = newState.member?.user ?? (await client.users.fetch(userId).catch(() => null));
            if (user) {
                await user.send(LATE_JOINER_DM).catch((err) => {
                    console.error('Could not DM late joiner:', err.message);
                });
                sessionState.dmIds.push(userId);
            }
            return;
        }
	},
};