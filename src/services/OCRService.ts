import { CalculationService } from './CalculationService';
import { EmbedService } from './EmbedService';
import { SongDataService } from './SongDataService';
import { DissonanceLogger, Service } from "@antaresque/dissonance";
import { EmbedBuilder, Message } from "discord.js";
import { GoogleVisionService } from "./GoogleVisionService";
import { writeFile } from 'fs/promises';

@Service()
export class OCRService {
    constructor(
        private readonly googleVisionService: GoogleVisionService, 
        private readonly songDataService: SongDataService,
        private readonly embedService: EmbedService,
        private readonly calculationService: CalculationService,
        private readonly logger: DissonanceLogger
    ) { }

    private isSpoiler = (content: string) => {
        // contains SPOILER
        return content.includes("SPOILER");
    };

    async handleOCRMessage(msg: Message<boolean>): Promise<EmbedBuilder[] | undefined> {
        if(msg.attachments.size == 0) {
            const embed = await this.getEmbed(msg.content);
            if(embed !== undefined)
                return [embed];
        }

        const embeds: EmbedBuilder[] = [];
        for(const v of msg.attachments) {
            const attachment = v[1];
            const embed = await this.getEmbed(attachment.url);
            if(embed !== undefined)
                embeds.push(embed);
        }   

        return embeds;
    }

    private async getEmbed(url: string) : Promise<EmbedBuilder | undefined> {
        const annotations = await GoogleVisionService.detectText(url);
        try {
            const { title, difficulty, accuracy, scoreDataNum } = this.googleVisionService.analyzeData(annotations);
            if(title === "" || title === undefined || difficulty === "" || difficulty === undefined || isNaN(accuracy) || accuracy === undefined || scoreDataNum === undefined)
                return;
        
            let songData = await this.songDataService.find(title.trim(), difficulty[0].toUpperCase() + difficulty.slice(1).toLowerCase());
            if(songData === undefined) 
                songData = await this.songDataService.findOCR(title.trim(), difficulty[0].toUpperCase() + difficulty.slice(1).toLowerCase(), scoreDataNum.reduce((a, b) => a + b, 0));
        
            let embed;
            if(songData === undefined) {
                embed = this.embedService.generateNoConstantEmbed(title, difficulty, accuracy, scoreDataNum, this.isSpoiler(url));
            }
            else {
                const { constant, noteCount } = songData;
                const calculation = this.calculationService.calculateScore(constant, scoreDataNum.join("/"), noteCount);
                if(calculation === undefined)
                    return;
    
                const name = this.makeFunny(songData.name); 
                const { result, diff } = calculation;
                embed = this.embedService.generateScoreEmbed(result, constant, diff, accuracy, scoreDataNum, name, difficulty, this.isSpoiler(url));
            } 
            
            // save to logs
            //await writeFile('logs.json', JSON.stringify(annotations), { flag: 'a+' });
            return embed;  
        }
        catch(e) {
            this.logger.info("invalid image found");
        }
    }

    private FUNNY_ALIASES: {[key: string]: string}
    = {
        "Music Like Magic!": "VERDELE !",
        "Colorful Marine Snow": "ceans",
        "Showtime Ruler": "Apple Showtime Ruler",
        "Law-evading Rock": "54 tely",
    }

    // 10% of time give funny title instead of original
    private makeFunny(name: string) {
        if(Math.random() < 0.1) {
            if(name in this.FUNNY_ALIASES) {
                return this.FUNNY_ALIASES[name];
            }
        }
        return name;
    }
}