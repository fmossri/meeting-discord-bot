const { MessageFlags } = require('discord.js');

async function interactionErrorHelper(interaction, errorMessage) {
	if (interaction.replied || interaction.deferred) {
		await interaction.followUp({
			content: errorMessage,
			flags: MessageFlags.Ephemeral,
		});
	} else {
		await interaction.reply({
			content: errorMessage,
			flags: MessageFlags.Ephemeral,
		});
	}
}

module.exports = { interactionErrorHelper };

