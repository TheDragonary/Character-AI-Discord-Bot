import { Events, MessageFlags, Interaction, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';

export default {
  	name: Events.InteractionCreate,
  	async execute(interaction: Interaction) {
        if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command || typeof command.autocomplete !== 'function') return;

            try {
                await command.autocomplete(interaction);
            } catch (error) {
                console.error(`Autocomplete error for ${interaction.commandName}:`, (error as Error).message);
            }
            return;
        }

    	if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: `There was an error while executing this command! ${(error as Error).message}`, flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: `There was an error while executing this command! ${(error as Error).message}`, flags: MessageFlags.Ephemeral });
            }
        }
  	},
};