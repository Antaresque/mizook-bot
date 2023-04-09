import { EmbedBuilder } from "discord.js";
import { Service } from "@antaresque/dissonance";
import { TourneyResult, TourneyScore } from "src/types";

const MIZOOK_COLOR = "#DDAACC";
@Service()
export class EmbedService {

    generateTourneyEmbed(results: TourneyResult[]) {
        return new EmbedBuilder()
            .setColor(MIZOOK_COLOR)
            .setTitle(`Tourney calculation results`)
            .addFields(results.filter(result => result.scores.length !== 0).map(result => this.generateFieldFromResult(result)));
    }

    generateFieldFromResult(result: TourneyResult): any {
        const calcAmountToAp = (score: string[]) => {
            if(score.length !== 5)
                return "";

            const result = parseInt(score[1]) + parseInt(score[2]) * 2 + parseInt(score[3]) * 3 + parseInt(score[4]) * 3;

            return `(-${result})`;
        }
        
        const generateScoreString = (score: TourneyScore): string => {
            return `${score.song} **${score.result}** ${score.rank} ${score.difficulty} ${score.constant} ${score.score.split('/').join(' ')} ${calcAmountToAp(score.score.split('/'))} ${score.accuracy}%`;
        };

        return {
            name: result.playerName,
            value: result.scores.map(score => generateScoreString(score)).join('\n') ?? "No scores yet"
        };
    }
    
    generateScoreEmbed(result: number, constant: number, diff: string, accuracy: number, scoreDataNum: number[], song: string, difficulty: string, isSpoiler: boolean = false) {
        if(isSpoiler)
            song = `||${song}||`;

        return new EmbedBuilder()
            .setColor(MIZOOK_COLOR)
            .setTitle(`${song} [${difficulty.toUpperCase()}]`)
            .addFields(
                { name: 'Result', value: `**${result.toFixed(2)}** [${constant.toFixed(2)} ${diff}] (*${this.calcRank(result)}*)` },
                { name: 'Accuracy', value: `${(accuracy * 100).toFixed(2)}%`, inline: true },
                { name: 'Score', value: `${scoreDataNum.join('/')}`, inline: true },
            );
    }

    generateNoConstantEmbed(title: string, difficulty: string, accuracy: number, scoreDataNum: number[], isSpoiler: boolean = false) {
        if(isSpoiler)
            title = `||${title}||`;
    
        return new EmbedBuilder()
        .setColor('#DDAACC')
        .setTitle(`${title} [${difficulty.toUpperCase()}]`)
        .addFields(
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
