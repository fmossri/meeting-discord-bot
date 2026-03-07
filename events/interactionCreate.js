const { Events, MessageFlags } = require('discord.js');

async function interactionErrorHelper(interaction, errorMessage) {
	if (interaction.replied || interaction.deferred) {
		await interaction.followUp({
			content: errorMessage,
			flags: MessageFlags.Ephemeral,
		});
	}
	else {
		await interaction.reply({
			content: errorMessage,
			flags: MessageFlags.Ephemeral,
		});
	}
}

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (interaction.isChatInputCommand()) {
			const command = interaction.client.commands.get(interaction.commandName);

			if (!command) {
				console.error(`No command matching ${interaction.commandName} was found.`);
				return;
			}

			try {
				await command.execute(interaction);
			}
			catch (error) {
				console.error(error);
				await interactionErrorHelper(interaction, 'There was an error while executing this command!');
			}
		}
		else if (interaction.isButton()) {
			try {
				await interaction.client.botCoordinator.handleButtonInteraction(interaction);
			}
			catch (error) {
				console.error(error);
				await interactionErrorHelper(interaction, 'There was an error while handling this button.');
			}
		}
		else {return;}
	},
};
