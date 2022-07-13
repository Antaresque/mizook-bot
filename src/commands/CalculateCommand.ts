import { CalculationService } from './../services/CalculationService';
import { EmbedService } from './../services/EmbedService';
import { SongDataService } from './../services/SongDataService';
import { AutocompleteInteraction, CommandInteraction } from "discord.js";
import { DissonanceCommandOptionType, DissonanceContext, DissonanceLogger, OnAutoComplete, OnCommandInteraction, SlashCommand } from "@antaresque/dissonance";

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

    async handle({ interaction }: DissonanceContext<CommandInteraction>) {
        const { options } = interaction;

        const song = options.getString('song');
        const difficulty = options.getString('difficulty');
        const score = options.getString('score');
        this.logger.log(`calculate: ${song} [${difficulty}] ${score}`, "INFO");

        const lookForSong = await this.dataService.find(song, difficulty);
        if (lookForSong === undefined) {
            this.logger.log("calculate: invalid arguments (song/difficulty)", 'WARN');
            return "Invalid arguments or chart wasn't found in database";
        }
        
        const constant = lookForSong.constant;
        const noteCount = lookForSong.noteCount;

        if (constant === undefined || score === null) {
            this.logger.log("calculate: no constant/score found", 'WARN')
            return "Invalid arguments or chart wasn't found in database";
        }

        const scoreData = this.calcService.calculateScore(constant, score, noteCount);
        if (scoreData === undefined) {
            this.logger.log("calculate: unable to calculate score", 'WARN')
            return "Invalid score data";
        }

        const embed = this.embedService.generateScoreEmbed(
            scoreData?.result, constant, scoreData?.diff, scoreData?.accuracy, scoreData?.scoreValues, song!, difficulty!
        );
        return await interaction.reply({ embeds: [embed] });
        
    }

    async autocomplete({interaction}: DissonanceContext<AutocompleteInteraction>) {
        const { options } = interaction;

        const songNames = await this.dataService.getSongNames();

        const focusedValue = options.getFocused().toString().toLowerCase();
        const filtered = songNames?.filter(choice => choice.toLowerCase().includes(focusedValue));
        if(filtered !== undefined && filtered.length <= 25)
            return filtered;
    }
}
