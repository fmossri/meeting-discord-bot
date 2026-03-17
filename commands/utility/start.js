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

		if (interaction.client.sessionStore.guildHasSession(interaction.guild?.id)) {
			await interaction.reply({
				content: 'A meeting is already in progress in this server.',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		await interaction.client.meetingController.startMeeting(interaction);
	},
};
