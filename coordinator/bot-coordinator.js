const prism = require('prism-media');
const { ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const { joinVoiceChannel, EndBehaviorType } = require('@discordjs/voice');
const { interactionErrorHelper } = require('../utils/interaction-errors.js');

function createBotCoordinator(sessionStore) {
    const confirmMsgToSession = new Map();

    async function connectToChannel(sessionId) {
        const sessionState = sessionStore.getSessionById(sessionId);
        if (!sessionState) {
            console.error('session not found.', sessionId);
            return false;
        }
        try {
            const voiceConnection = await joinVoiceChannel({
                channelId: sessionState.voiceChannelId,
                guildId: sessionState.originalInteraction.guild.id,
                adapterCreator: sessionState.originalInteraction.guild.voiceAdapterCreator,
                selfDeaf: false
            });
            sessionState.voiceConnection = voiceConnection;
            console.log('voice connection established.');
            return true;
        }
        catch (error) {
            console.error('error connecting to channel.', error);
            return false;
        }
    }

    async function sendMeetingStartMessage(interaction) {
		const acceptButton = new ButtonBuilder()
			.setCustomId('disclaimer-accept')
			.setLabel('Accept')
			.setStyle(ButtonStyle.Success);

		const rejectButton = new ButtonBuilder()
			.setCustomId('disclaimer-reject')
			.setLabel('Reject')
			.setStyle(ButtonStyle.Danger);

		const buttonsRow = new ActionRowBuilder()
			.addComponents(acceptButton, rejectButton);

		return await interaction.reply({
			content: 'bot presentation, meeting start message and disclaimer message placeholder.',
			components: [buttonsRow],
		});
    }

    function unsubscribeFromStream(sessionId, participantId) {
        const sessionState = sessionStore.getSessionById(sessionId);
        if (!sessionState) {
            console.error('session not found.', sessionId);
            return false;
        }
        try {
            const participant = sessionState.participantStates.get(participantId);
            if (!participant) {
                console.error('participant not found.', participantId);
                return false;
            }
            if (participant.subscription) {
                if (participant.pcmStream) {
                    participant.pcmStream.removeAllListeners();
                    participant.pcmStream = null;
                }
                participant.subscription.destroy();
                participant.subscription = null;

            }
            return true;
        } catch (error) {
            console.error('error unsubscribing from stream.', error);
            return false;
        }
    }

    function subscribeToStream(sessionId, participantId) {
        const sessionState = sessionStore.getSessionById(sessionId);
        if (!sessionState) {
            console.error('session not found.', sessionId);
            return false;
        }
        try {
            const participant = sessionState.participantStates.get(participantId);
            if (!participant) {
                console.error('participant not found.', participantId);
                return false;
            }
            if (participant.subscription) {
                return true;
            }
            const options = {
                end: {
                    behavior: EndBehaviorType.AfterSilence,
                    duration: 100
                }
            };
            const receiver = sessionState.voiceConnection.receiver;
            const decoder = new prism.opus.Decoder(
                {
                    channels: 1,
                    rate: 16000,
                    frameSize: 320
                }
            );
            participant.subscription = receiver.subscribe(participantId, options);
            participant.subscription.on('error', (error) => {
                console.error('error subscribing to stream.', error);
                unsubscribeFromStream(sessionId, participantId);
            });
            participant.subscription.on('end', () => {
                console.log('stream ended.');
                unsubscribeFromStream(sessionId, participantId);
            });
            participant.pcmStream = participant.subscription.pipe(decoder);
            return true;
        } catch (error) {
            console.error('error subscribing to stream.', error);
            return false;
        }
    }

    async function registerParticipant(sessionId, participantId, interaction) {
        const sessionState = sessionStore.getSessionById(sessionId);
        if (!sessionState) {
            console.error('session not found.', sessionId);
            await interaction.editReply({
                content: 'An error occurred while registering you as a participant: session not found.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        if (!sessionState.voiceConnection) {
            if (!(await connectToChannel(sessionId))) {
                throw new Error('error connecting to channel.');
            }
        }
        if (sessionState.timeoutId) {
            clearTimeout(sessionState.timeoutId);
            sessionState.timeoutId = null;
        }

        if (!sessionState.started) {
            const started = await interaction.client.sessionManager.startSession(sessionId);
            if (!started) return false;
            sessionState.started = true;
        }
        sessionState.participantIds.push(participantId);
        const participantState = {
            subscription: null,
            displayName: interaction.user.displayName,
            pcmStream: null,
            chunkerState: {
                samplesBuffer: Buffer.alloc(0),
                samplesInBuffer: 0,
                totalSamplesEmitted: 0,
            }
        };

        sessionState.participantStates.set(participantId, participantState);
        if (!sessionState.paused) {
            subscribeToStream(sessionId, participantId);
            interaction.client.sessionManager.chunkStream(sessionId, participantId);
            await sessionState.originalInteraction.followUp({
                content: `<@${participantId}> has accepted the disclaimer and is included in the meeting's transcript.`,
            });
        } else {	
            await sessionState.originalInteraction.followUp({
                content: `<@${participantId}> has accepted the disclaimer and is included in the meeting's transcript, but recording is paused.`,
            });
        }

        return true;
    }

    function reconnectParticipant(sessionId, participantId) {
        const sessionState = sessionStore.getSessionById(sessionId);
        if (!sessionState) {
            console.error('session not found.', sessionId);
            return false;
        }
        const participant = sessionState.participantStates.get(participantId);
        if (!participant) {
            console.error('participant not found.', participantId);
            return false;
        }
        try {
            if (participant.subscription) {
                unsubscribeFromStream(sessionId, participantId);
            }
            subscribeToStream(sessionId, participantId);
            sessionState.originalInteraction.client.sessionManager.chunkStream(sessionId, participantId);
            return true;
        }
        catch (error) {
            console.error('error reconnecting participant.', error);
            return false;
        }
    }

    function stopVoiceCapture(sessionId) {
        const sessionState = sessionStore.getSessionById(sessionId);
        if (!sessionState) {
            console.error('session not found.', sessionId);
            return false;
        }
        try {
            for (const participantId of sessionState.participantIds) {
                unsubscribeFromStream(sessionId, participantId);
            }
            if (sessionState.voiceConnection) {
                sessionState.voiceConnection.destroy();
                sessionState.voiceConnection = null;
            }
            return true;
        }
        catch (error) {
            console.error('error stopping voice capture.', error);
            return false;
        }
    }

    async function handleButtonInteraction(interaction) {
        const messageId = interaction?.message?.id;
        const userId = interaction?.user?.id;
        let sessionId = messageId;
        let sessionState = sessionStore.getSessionById(messageId);
        if (interaction.customId === 'close-meeting-confirm') {
            sessionId = confirmMsgToSession.get(messageId);
            if (sessionId) sessionState = sessionStore.getSessionById(sessionId);
        }
        if (!sessionState) {
            await interaction.deferUpdate();
            return;
        }
        try {
            switch (interaction.customId) {
                case 'disclaimer-accept':
                    if (!sessionState.participantIds.includes(userId) && !sessionState.rejectedIds.includes(userId)) {
                        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                        if (await registerParticipant(messageId, userId, interaction)) {
                            await interaction.editReply({
                                content: 'Disclaimer accepted. You are now a participant in the meeting and being recorded.',
                            });
                            break;
                        } else {
                            await interaction.editReply({
                                content: 'An error occurred while adding you as a participant.',
                            });
                            break;
                        }
                    }
                
                    else {await interaction.deferUpdate(); break;}

                case 'disclaimer-reject':
                    if (!sessionState.participantIds.includes(userId) && !sessionState.rejectedIds.includes(userId)) {
                        sessionState.rejectedIds.push(userId);
                        await interaction.reply({
                            content: 'Disclaimer rejected. You are not a participant in the meeting and will not be recorded.',
                            flags: MessageFlags.Ephemeral,
                        });

                        console.log('disclaimer rejected by user.', userId);
                        break;
                    }
                    else {await interaction.deferUpdate(); break;}
            
                case 'close-meeting-confirm':
                    if (sessionState.timeoutId) {
                        clearTimeout(sessionState.timeoutId);
                        sessionState.timeoutId = null;
                    }
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                    stopVoiceCapture(sessionId);

                    const { reportPath, summary } = await interaction.client.sessionManager.closeSession(sessionId);
                    await sessionState.originalInteraction.followUp({
                        content: `The meeting is over. Thank you for participating.\n\n**Summary:**\n${summary}`,
                    });

                    const disabledAccept = new ButtonBuilder()
                        .setCustomId('disclaimer-accept')
                        .setLabel('Accept')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true);
                    const disabledReject = new ButtonBuilder()
                        .setCustomId('disclaimer-reject')
                        .setLabel('Reject')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(true);
                    const disabledRow = new ActionRowBuilder().addComponents(disabledAccept, disabledReject);
                    await sessionState.originalInteraction.editReply({ components: [disabledRow] });

                    sessionStore.deleteSession(sessionId);
                    confirmMsgToSession.delete(interaction.message.id);
                    await interaction.deleteReply();
                    console.log('session deleted.');
                    break;

                default:
                    await interaction.deferUpdate();
                    break;
            }
        } catch (error) {
            console.error('An error occurred while handling the button interaction.', error);
            await interactionErrorHelper(interaction, 'An error occurred while handling the button interaction.');
        }
    }

    async function startMeeting(interaction) {
        const voiceChannel = interaction.member.voice.channel;

		const interactionResponse = await sendMeetingStartMessage(interaction);

		const replyMessageObject = await interactionResponse.fetch();
		const sessionId = replyMessageObject.id;

        const sessionState = {
            started: false,
            paused: false,
			participantIds: [],
            rejectedIds: [],
            dmIds: [],
            participantStates: new Map(),
			voiceChannelId: voiceChannel.id,
			originalInteraction: interaction,
			timeoutId: null,
		};
		const sessionTimeoutId = setTimeout(async () => {
			const session = sessionStore.getSessionById(sessionId);
			if (session) {
                try {
                    await session.originalInteraction.followUp({
                        content: 'Session timed out after 1 minute. All participants must accept to start the meeting.',
                    });
                }
                catch (error) {
                    console.error('error following up on session timeout.', error);
                }
			}
			sessionStore.deleteSession(sessionId);
			console.log('session timed out and deleted.');
		}, 1000 * 60);
		sessionState.timeoutId = sessionTimeoutId;
		sessionStore.createSession(sessionId, sessionState);
        return true;
    }

    async function pauseMeeting(sessionId) {
        const sessionState = sessionStore.getSessionById(sessionId);
        try {
            stopVoiceCapture(sessionId);
            sessionState.paused = true;
            await sessionState.originalInteraction.followUp({
                content: 'Meeting recording paused.',
            });
        } catch (error) {
            console.error('error pausing meeting.', error);
            throw new Error('error pausing meeting.');
        }
    }

    async function resumeMeeting(sessionId) {
        const sessionState = sessionStore.getSessionById(sessionId);
        try {
            if (!sessionState.voiceConnection) {
                if (!(await connectToChannel(sessionId))) {
                    console.error('error connecting to channel.');
                    return false;
                }
            }
            const voiceChannel = await sessionState.originalInteraction.guild.channels.fetch(sessionState.voiceChannelId);
            if (!voiceChannel) {
                console.error('voice channel not found.', sessionState.voiceChannelId);
                return false;
            }
            for (const member of voiceChannel.members) {
                if (sessionState.participantIds.includes(member.user.id)) {
                    reconnectParticipant(sessionId, member.user.id);
                }
            }
            sessionState.paused = false;
            await sessionState.originalInteraction.followUp({
                content: 'Meeting recording resumed.',
            });
            return true;
        }
        catch (error) {
            console.error('error resuming meeting.', error);
            throw new Error(error);
        }
    }

    async function closeMeeting(sessionId, interaction) {
        const sessionState = sessionStore.getSessionById(sessionId);
        const confirmButton = new ButtonBuilder()
            .setCustomId('close-meeting-confirm')
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Danger);
        const confirmRow = new ActionRowBuilder().addComponents(confirmButton);
        const confirmMessage = await interaction.editReply({
            content: 'Are you sure you want to close the meeting?',
            flags: MessageFlags.Ephemeral,
            components: [confirmRow],
        });

        confirmMsgToSession.set(confirmMessage.id, sessionId);
        const timeoutId = setTimeout(async () => {
            try {
                await confirmMessage.delete();
            } catch (err) {
                console.error('Failed to delete confirm message:', err);
            }
            confirmMsgToSession.delete(confirmMessage.id);
            console.log('End meeting confirm message timed out and deleted.');
        }, 1000 * 60);
        sessionState.timeoutId = timeoutId;

        console.log('End meeting confirm message sent.');
        return true;
    }

    return {
        startMeeting,
        closeMeeting,
        pauseMeeting,
        resumeMeeting,
        reconnectParticipant,
        handleButtonInteraction,

    };
}
module.exports = { createBotCoordinator };