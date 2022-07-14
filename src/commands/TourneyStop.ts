import { SlashCommand, OnCommandInteraction, DissonanceContext } from "@antaresque/dissonance";
import { CommandInteraction, CacheType } from "discord.js";
import { TourneyCalculationService } from "./../services/TourneyCalculationService";

@SlashCommand({
    name: 't-finish',
    description: "Finish calculating scores and print out the result"
})
export class TourneyStopCommand implements OnCommandInteraction {
    constructor(private calc: TourneyCalculationService) { }
    
    async handle({ interaction }: DissonanceContext<CommandInteraction<CacheType>>) {
        const { user } = interaction;

        if(!this.calc.checkUser(user))
            return await interaction.reply({ content: "No active calculation found, try using /t-start first", ephemeral: true });

        const resultEmbed = this.calc.getResultForUser(user);
        if(!resultEmbed)
            return await interaction.reply({ content: "No active calculation found, try using /t-start first", ephemeral: true });

        return await interaction.reply({ embeds: [resultEmbed] })
    }
}