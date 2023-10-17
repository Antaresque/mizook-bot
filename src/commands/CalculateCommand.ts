import { CalculationService } from './../services/CalculationService';
import { EmbedService } from './../services/EmbedService';
import { SongDataService } from './../services/SongDataService';
import { DissonanceAutocompleteContext, DissonanceCommandContext, DissonanceCommandOptionType, DissonanceLogger, OnAutoComplete, OnCommandInteraction, SlashCommand } from "@antaresque/dissonance";

@SlashCommand('calculate')
export class CalculateCommand implements OnCommandInteraction, OnAutoComplete {
    constructor(private dataService: SongDataService, private embedService: EmbedService, private calcService: CalculationService, private logger: DissonanceLogger) { }

    async register() {
        const difficultyChoices = this.dataService.getSongDifficulties().map(diff => ({ name: diff, value: diff }));

        const options = [
            { name: 'song', description: 'Song name', type: DissonanceCommandOptionType.STRING, required: true, autocomplete: true },
            { name: 'difficulty', description: 'Chart difficulty', type: DissonanceCommandOptionType.STRING, required: true, choices: difficultyChoices },
            { name: 'score', description: 'Your score in P/G/G/B/M format (supports greats only and G/G/B/M as well)', type: DissonanceCommandOptionType.STRING, required: true }
        ];

        return {
            name: 'calculate',
            description: 'Calculate score for chosen chart',
            options: options,
        }
    }

    async handle({ interaction, reply }: DissonanceCommandContext) {
        const { options, guildId } = interaction;

        const song = options.get('song')?.value as string;
        const difficulty = options.get('difficulty')?.value as string;
        const score = options.get('score')?.value as string;
        this.logger.info(`calculate: ${song} [${difficulty}] ${score}`);

        const lookForSong = await this.dataService.find(song, difficulty, guildId);
        if (lookForSong === undefined) {
            this.logger.warn("calculate: invalid arguments (song/difficulty)");
            return "Invalid arguments or chart wasn't found in database";
        }
        
        const constant = lookForSong.constant;
        const noteCount = lookForSong.noteCount;

        if (constant === undefined || score === null) {
            this.logger.warn("calculate: no constant/score found")
            return reply("Invalid arguments or chart wasn't found in database");
        }

        const scoreData = this.calcService.calculateScore(constant, score, noteCount);
        if (scoreData === undefined) {
            this.logger.warn("calculate: unable to calculate score")
            return reply("Invalid score data");
        }

        const embed = this.embedService.generateScoreEmbed(
            scoreData?.result, constant, scoreData?.diff, scoreData?.accuracy, scoreData?.scoreValues, lookForSong.name, difficulty!
        );
        
        await interaction.reply({ embeds: [embed] });   
    }

    async autocomplete({interaction, respond}: DissonanceAutocompleteContext) {
        const { options, guildId } = interaction;

        const songNames = await this.dataService.getSongNames(guildId);

        const focusedValue = options.getFocused().toString().toLowerCase();
        const filtered = songNames?.filter(choice => choice.toLowerCase().includes(focusedValue));
        if(filtered !== undefined && filtered.length <= 25)
            await respond(filtered);
    }
}
