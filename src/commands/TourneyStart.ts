import { SlashCommand, OnCommandInteraction, DissonanceCommandOptionType, DissonanceContext } from "@antaresque/dissonance";
import { CommandInteraction, CacheType } from "discord.js";
import { TourneyCalculationService } from "./../services/TourneyCalculationService";

@SlashCommand('t-start')
export class TourneyStartCommand implements OnCommandInteraction {

    register() {
        const options = [
            { name: 'playernames', description: 'Names of the players, separated by semicolon (;)', type: DissonanceCommandOptionType.STRING, required: true },
        ];

        return {
            name: 't-start',
            description: 'Start calculating the scores for the lobby',
            options: options,
        }
    }

    constructor(private service: TourneyCalculationService) { }

    async handle({ interaction }: DissonanceContext<CommandInteraction<CacheType>>) {
        const { options, user } = interaction;

        const players = options.getString("playernames", true);
        const playerNames = players.split(';');

        if(playerNames.length > 5 || playerNames.length === 0)
            return await interaction.reply({ content: "Invalid or too many player names, check your input again.",  ephemeral: true });

        this.service.addUser(playerNames, user);
        
        return await interaction.reply({ content: "Storing your scores! Use /t-calc to start calculations.",  ephemeral: true })
    }
}