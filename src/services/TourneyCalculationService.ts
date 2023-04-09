import { CalculationService } from './CalculationService';
import { DissonanceLogger, Service } from "@antaresque/dissonance";
import { EmbedBuilder, User } from "discord.js";
import { EmbedService } from './EmbedService';
import { SongDataService } from './SongDataService';
import { TourneyResult, TourneyScore } from './../types';

@Service()
export class TourneyCalculationService {
    private _map: Map<string, TourneyResult[]> = new Map();

    constructor(private data: SongDataService, private embed: EmbedService, private calc: CalculationService, private readonly logger: DissonanceLogger) { }

    getResultForUser(user: User): EmbedBuilder | null {
        if(!this._map.has(user.id))
            return null;

        const results = this._map.get(user.id);
        if(!results)
            return null;

        this._map.delete(user.id);
        return this.embed.generateTourneyEmbed(results);
    }

    addUser(playerNames: string[], user: User) {
        const results = [];

        for(let name of playerNames) {
            if(!name) 
                continue;

            const result = { 
                playerName: name,
                scores: []
            };

            results.push(result);
        }

        if(results.length > 0)
            this._map.set(user.id, results);
    }
    
    checkUser(user: User) {
        return this._map.has(user.id);
    }
    addScores(user: User, scoreArray: (TourneyScore | null)[]) {
        const results = this._map.get(user.id);
        let counter = 0;
        //this.logger.info(scoreArray);

        if(!results)
            return counter;

        for(let i = 0; i < 5; i++) {
            const result = results[i];
            const score = scoreArray[i];
            if(score) {
                result.scores.push(score); 
                counter++;
            }
        }

        this.logger.info("current state of results: " + JSON.stringify(results));
        return counter;
    }
    async parseScore(score: string, song: string, difficulty: 'MASTER' | 'EXPERT' | 'HARD') {
        const songData = (await this.data.getChartData()).find(s => s.name === song && s.difficulty.toUpperCase() === difficulty);
        if(!songData)
            return null;

        const constant = songData.constant;
        const noteCount = songData.noteCount;

        if(!constant)
            return null;

        const scoreData = this.calc.calculateScore(constant, score, noteCount);
        if(!scoreData)
            return null;

        const result = {
            song: songData.name,
            result: scoreData.result.toFixed(2),
            rank: this.embed.calcRank(scoreData.result),
            difficulty: difficulty,
            constant: constant.toFixed(1),
            score: scoreData.scoreValues.join('/'),
            accuracy: (scoreData.accuracy * 100).toFixed(2)
        };

        return result;
    }

    parseDifficulty(diff: string) {
        const d = diff.toLowerCase();

        if("master".startsWith(d))
            return "MASTER";
        if("expert".startsWith(d))
            return "EXPERT";
        if("hard".startsWith(d) || d === 'hrd')
            return "HARD";

        return null;
    }

}