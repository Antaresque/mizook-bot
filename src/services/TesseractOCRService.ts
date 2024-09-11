import { DissonanceLogger, Service } from "@antaresque/dissonance";
import { TesseractImageService } from "./TesseractImageService";
import { TesseractService } from "./TesseractService";
import { EmbedBuilder } from "discord.js";
import { CalculationService } from "./CalculationService";
import { EmbedService } from "./EmbedService";
import { SongDataService } from "./SongDataService";
import axios from 'axios';
import { RecognizeResult } from "tesseract.js";

@Service()
export class TesseractOCRService {
    constructor(
        private readonly imageService: TesseractImageService, 
        private readonly tesseract: TesseractService,
        private readonly songDataService: SongDataService,
        private readonly embedService: EmbedService,
        private readonly calculationService: CalculationService,
        private readonly logger: DissonanceLogger) {}

    public async urlIntoEmbed(url: string) : Promise<EmbedBuilder | undefined> {
        try {
            this.logger.debug("OCR attempt");
            const response = await axios.get(url, { responseType: 'arraybuffer' })
            const rawBuffer = Buffer.from(response.data);
            const { buffers, version } = await this.imageService.cutBuffer(rawBuffer);
            const tesseractData = await this.tesseract.detectFromBuffer(buffers, version);
            const preparedData = this.prepareResults(tesseractData);
            const embed = await this.inferData(preparedData);

            return embed;
        }
        catch(e) {
            this.logger.info("TesseractOCR error, aborting task" + e);
            return;
        }
    }

    private prepareResults(data: { mainData: RecognizeResult, secondaryData: RecognizeResult | null, accuracyData: RecognizeResult }) {
        const { mainData, secondaryData } = data;
        let titleData;

        if(secondaryData !== null && mainData.data.confidence < 50 && secondaryData?.data.confidence > mainData.data.confidence)
            titleData = secondaryData.data;
        else 
            titleData = mainData.data;

        const title = titleData.text.trim();

        const accuracyData = data.accuracyData.data;
        const accuracy = accuracyData.text.split('\n').map(_ => parseInt(_)).filter(_ => isFinite(_));
      
        this.logger.debug(`${title} [${accuracy}] (conf: ${accuracyData.confidence}) \n`);

        return { title: title, scoreNumbers: accuracy };
    }

    private async inferData(data: {title: string, scoreNumbers: number[]}) {
        const { title, scoreNumbers } = data;
        const notecount = scoreNumbers.reduce((acc, i) => acc+i);
        const accuracy = this.calculationService.calculateAccuracy(scoreNumbers)

        let songData = await this.songDataService.findOCRWithoutDiff(title.trim(), notecount);
        if(songData === undefined)
            return this.embedService.generateNoConstantEmbed(title, "", accuracy, scoreNumbers, false);
        
        const { constant, noteCount } = songData;
        const calculation = this.calculationService.calculateScore(constant, scoreNumbers.join("/"), noteCount);
        if(calculation === undefined)
            return;

        this.logger.debug(constant + accuracy + scoreNumbers.join('/') + songData.name + songData.difficulty)
        const { result, diff } = calculation;
        return this.embedService.generateScoreEmbed(result, constant, diff, accuracy, scoreNumbers, songData.name, songData.difficulty, false);
    }
}