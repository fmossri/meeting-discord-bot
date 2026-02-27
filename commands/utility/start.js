const { SlashCommandBuilder, MessageFlags, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { sessionStore } = require('../../session.js');

module.exports = {
	data: new SlashCommandBuilder().setName('start').setDescription('Starts procedures to transcribe and summarize a meeting'),
	async execute(interaction) {
		const member = interaction.member;
		if (!member.voice.channel) {
			await interaction.reply({
				content: 'Must be connected to a voice channel',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const voiceChannel = member.voice.channel;
		if (sessionStore.channelHasSession(voiceChannel.id)) {
			await interaction.reply({
				content: 'A session is already in progress in this channel',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const participantIds = voiceChannel.members.map(channelMember => channelMember.user.id);

		const acceptButton = new ButtonBuilder()
			.setCustomId('disclaimer-accept')
			.setLabel('Accept')
			.setStyle(ButtonStyle.Success);

		const rejectButton = new ButtonBuilder()
			.setCustomId('disclaimer-reject')
			.setLabel('Reject')
			.setStyle(ButtonStyle.Danger);

		const disclaimerRow = new ActionRowBuilder()
			.addComponents(acceptButton, rejectButton);

		const interactionResponse = await interaction.reply({
			content: `Starting procedures for a meeting recording and summarization.\n
             Participants:\n ${participantIds.map(id => `<@${id}>`).join('\n')}`,
			components: [disclaimerRow],
		});

		const replyMessage = await interactionResponse.fetch();
		const messageId = replyMessage.id;
		const sessionData = {
			participantIds,
			voiceChannelId: voiceChannel.id,
			acceptedIds: [],
			disclaimerAccepted: false,
			originalInteraction: interaction,
			timeoutId: null,
		};
		sessionStore.createSession(messageId, sessionData);

		const sessionTimeoutId = setTimeout(async () => {
			const session = sessionStore.getSessionByMessageId(messageId);
			if (session) {
				await session.originalInteraction.followUp({
					content: 'Session timed out after 1 minute. All participants must accept to start the meeting.',
				});
			}
			sessionStore.deleteSession(messageId);
			console.log('session timed out and deleted.');
		}, 1000 * 60);
		sessionData.timeoutId = sessionTimeoutId;

		console.log('session timeout set.');
	},
};
