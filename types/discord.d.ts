import { Collection } from 'discord.js';
import { SlashCommand } from './slashCommand';

declare module 'discord.js' {
    interface Client {
        commands: Collection<string, SlashCommand>;
    }

    interface SlashCommand {
        data: SlashCommandBuilder;
        execute(interaction: CommandInteraction): Promise<void>;
        autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
    }
}