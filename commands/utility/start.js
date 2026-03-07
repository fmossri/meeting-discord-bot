const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder().setName('start').setDescription('Starts procedures to transcribe and summarize a meeting'),
	async execute(interaction) {
		const member = interaction.member;
		const voiceChannel = member?.voice?.channel;
		if (!voiceChannel) {
			await interaction.reply({
				content: 'Must be connected to a voice channel',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (interaction.client.sessionStore.channelHasSession(voiceChannel.id)) {
			await interaction.reply({
				content: 'A session is already in progress in this channel',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		await interaction.client.botCoordinator.startMeeting(interaction);
	},
};
