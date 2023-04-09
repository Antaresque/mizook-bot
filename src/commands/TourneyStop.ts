import { SlashCommand, OnCommandInteraction, DissonanceContext, DissonanceCommandContext } from "@antaresque/dissonance";
import { TourneyCalculationService } from "./../services/TourneyCalculationService";

@SlashCommand({
    name: 't-finish',
    description: "Finish calculating scores and print out the result"
})
export class TourneyStopCommand implements OnCommandInteraction {
    constructor(private calc: TourneyCalculationService) { }
    
    async handle({ interaction }: DissonanceCommandContext) {
        const { user } = interaction;

        if(!this.calc.checkUser(user)){
            await interaction.reply({ content: "No active calculation found, try using /t-start first", ephemeral: true });
            return;
        }

        const resultEmbed = this.calc.getResultForUser(user);
        if(!resultEmbed){
            await interaction.reply({ content: "No active calculation found, try using /t-start first", ephemeral: true });
            return;
        }

        await interaction.reply({ embeds: [resultEmbed] })
    }
}