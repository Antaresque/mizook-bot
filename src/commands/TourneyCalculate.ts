import { SongDataService } from './../services/SongDataService';
import { DissonanceAutocompleteContext, DissonanceCommandContext, DissonanceCommandOptionType, OnAutoComplete, OnCommandInteraction, SlashCommand } from "@antaresque/dissonance";
import { TourneyCalculationService } from "./../services/TourneyCalculationService";

// start, calc, stop


@SlashCommand('t-calc')
export class TourneyCalculateCommand implements OnCommandInteraction, OnAutoComplete {
    constructor(private dataService: SongDataService, private calcService: TourneyCalculationService) {}

    register() {
        const options = [
            { name: 'song', description: 'Song name', type: DissonanceCommandOptionType.STRING, required: true, autocomplete: true },
            { name: 'p1', description: "Score of first player, e.g. EXPERT 230/0/0/0/1, MAS 12, H 3/0/0/2", type: DissonanceCommandOptionType.STRING },
            { name: 'p2', description: "Score of second player, leave empty if doesn't exist or skipping round", type: DissonanceCommandOptionType.STRING },
            { name: 'p3', description: "Score of third player, leave empty if doesn't exist or skipping round", type: DissonanceCommandOptionType.STRING },
            { name: 'p4', description: "Score of fourth player, leave empty if doesn't exist or skipping round", type: DissonanceCommandOptionType.STRING },
            { name: 'p5', description: "Score of fifth player, leave empty if doesn't exist or skipping round", type: DissonanceCommandOptionType.STRING }
        ];

        return {
            name: 't-calc',
            description: 'Calculate the score for the single map. (use /t-start before)',
            options: options,
        }
    }

    async handle({ interaction }: DissonanceCommandContext) {
        const { user, options } = interaction;

        if(!this.calcService.checkUser(user)){
            await interaction.reply({ content: "No active calculation found, try using /t-start first", ephemeral: true });
            return;
        }
        
        const song = options.get("song", true).value as string;

        const scoreArray = await this.getScoresFromOptions(options);
        const amountOfScores = this.calcService.addScores(user, scoreArray);

        await interaction.reply({ content: `Finished parsing, counted scores: ${amountOfScores}`, ephemeral: true })
    }

    async autocomplete({ interaction, respond }: DissonanceAutocompleteContext) {
        const { options } = interaction;

        const songNames = await this.dataService.getSongNames();

        const focusedValue = options.getFocused().toString().toLowerCase();
        const filtered = songNames?.filter(choice => choice.toLowerCase().includes(focusedValue));
        if(filtered !== undefined && filtered.length <= 25)
            await respond(filtered);
    }

    async getScoresFromOptions(options: any) {
        const song = options.get('song', true).value as string;
        const playerArray = [];

        for(let i = 1; i <= 5; i++) {
            const argument = options.get(`p${i}`)?.value as string;

            const strArray = argument?.split(" ");
            if(!strArray || strArray.length !== 2) {
                playerArray.push(null);
                continue;
            }

            const [diff, score] = strArray;
            const parsedDiff = this.calcService.parseDifficulty(diff);
            if(parsedDiff === null) {
                playerArray.push(null);
                continue;
            }

            const parsedScore = await this.calcService.parseScore(score, song, parsedDiff);
            if(!parsedScore) {
                playerArray.push(null);
                continue;
            }

            playerArray.push(parsedScore);
        }

        return playerArray;
    }
}
