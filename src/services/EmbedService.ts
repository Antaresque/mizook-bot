import { MessageEmbed } from "discord.js";
import { Service } from "@antaresque/dissonance";
import { TourneyResult, TourneyScore } from "src/types";

const MIZOOK_COLOR = "#DDAACC";
@Service()
export class EmbedService {

    generateTourneyEmbed(results: TourneyResult[]) {
        return new MessageEmbed()
            .setColor(MIZOOK_COLOR)
            .setTitle(`Tourney calculation results`)
            .addFields(results.filter(result => result.scores.length !== 0).map(result => this.generateFieldFromResult(result)));
    }

    generateFieldFromResult(result: TourneyResult): any {
        const generateScoreString = (score: TourneyScore): string => {
            return `${score.song} **${score.result}** ${score.rank} ${score.difficulty} ${score.constant} ${score.score.split('/').join(' ')} ${score.accuracy}%`;
        };

        return {
            name: result.playerName,
            value: result.scores.map(score => generateScoreString(score)).join('\n') ?? "No scores yet"
        };
    }
    
    generateScoreEmbed(result: number, constant: number, diff: string, accuracy: number, scoreDataNum: number[], song: string, difficulty: string) {
        return new MessageEmbed()
            .setColor(MIZOOK_COLOR)
            .setTitle(`${song} [${difficulty.toUpperCase()}]`)
            .addFields(
                { name: 'Result', value: `**${result.toFixed(2)}** [${constant.toFixed(2)} ${diff}] (*${this.calcRank(result)}*)` },
                { name: 'Accuracy', value: `${(accuracy * 100).toFixed(2)}%`, inline: true },
                { name: 'Score', value: `${scoreDataNum.join('/')}`, inline: true },
            );
    }

    calcRank(constant: number): string {
        if (constant >= 36)
            return "Space Gorilla";
        else if (constant >= 34)
            return "Gorilla";
        else if (constant >= 32)
            return "Diamond";
        else if (constant >= 30)
            return "Platinum";
        else if (constant >= 26)
            return "Gold";
        else if (constant >= 21)
            return "Silver";
        else if (constant >= 17.5)
            return "Bronze";
        else if (constant >= 0)
            return "Novice";
        else
            return "Troll";
    }
}
