import { EmbedBuilder } from "discord.js";
import { Service } from "@antaresque/dissonance";
import { ChartData, TourneyResult, TourneyScore } from "src/types";

const MIZOOK_COLOR = "#DDAACC";
@Service()
export class EmbedService {

    generateTourneyEmbed(results: TourneyResult[]) {
        return new EmbedBuilder()
            .setColor(MIZOOK_COLOR)
            .setTitle(`Tourney calculation results`)
            .addFields({
                name: "Results",
                value: results.map(result => this.generateFieldFromResult(result)).join('\n')
            });
    }

    generateOCRTourneyEmbed(results: any[]) {
        return new EmbedBuilder()
            .setColor(MIZOOK_COLOR)
            .setTitle(`Tourney calculation results`)
            .addFields(results.filter(result => result.scores.length !== 0).map(result => this.generateFieldFromOCRResult(result)));
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

    generateFieldFromOCRResult(result: any): any {
        return `${result.name}\t${result.title}\t${result.difficulty}\t${result.score.great}\t${result.score.good}\t${result.score.bad}\t${result.score.miss}`;
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

    generateCoopEmbed(data: {
        result: number;
        diff: string;
        accuracy: number;
        scoreValues: number[];
        songData: ChartData;
        player: string | null;
        difficulty: string | null,
        accuracyConfidence: number}[]) 
    {
        const fields = [];
        for(let i = 0; i < data.length; i++) {
            const {result,diff,accuracy,scoreValues,songData,player,difficulty, accuracyConfidence} = data[i];

            let stringName = `**${player ?? `Player ${i+1}`}** [${difficulty}]`;
            if(accuracyConfidence < 90)
                stringName += " low conf, check"
            const stringValue = `${scoreValues.join('/')} (${(accuracy * 100).toFixed(2)}%) **${result.toFixed(2)}**`
            fields.push({ name: stringName, value: stringValue })
        }

        return new EmbedBuilder()
        .setColor('#DDAACC')
        .setTitle(`${data[0].songData.name} - coop match`)
        .addFields(fields);
    }

    generateCoopRaw(data: {
        result: number;
        diff: string;
        accuracy: number;
        scoreValues: number[];
        songData: ChartData;
        player: string | null;
        difficulty: string | null,
        accuracyConfidence: number}[]) 
    {
        let valueString = "";
        for(let i = 0; i < data.length; i++) {
            const {result,diff,accuracy,scoreValues,songData,player,difficulty, accuracyConfidence} = data[i];

            valueString += player ?? "";
            valueString += "\t";
            valueString += songData.name;
            valueString += "\t";
            valueString += difficulty;
            valueString += "\t";
            valueString += scoreValues[1];
            valueString += "\t";
            valueString += scoreValues[2];
            valueString += "\t";
            valueString += scoreValues[3];
            valueString += "\t";
            valueString += scoreValues[4];
            valueString += "\t";
            valueString += "\n";
        }

        return valueString;
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
