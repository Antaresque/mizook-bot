import { DissonanceLogger, Service } from "@antaresque/dissonance";
import { TesseractImageService } from "./TesseractImageService";
import { TesseractService } from "./TesseractService";
import { EmbedBuilder } from "discord.js";
import { CalculationService } from "./CalculationService";
import { EmbedService } from "./EmbedService";
import { SongDataService } from "./SongDataService";
import axios from 'axios';
import { RecognizeResult } from "tesseract.js";
import { GoogleDataService } from "./GoogleDataService";

@Service()
export class TesseractOCRService {
    constructor(
        private readonly imageService: TesseractImageService, 
        private readonly tesseract: TesseractService,
        private readonly songDataService: SongDataService,
        private readonly embedService: EmbedService,
        private readonly calculationService: CalculationService,
        private readonly googleService: GoogleDataService,
        private readonly logger: DissonanceLogger) {}

    public async urlIntoData(url: string, possibleSongNames: string | null, assignment = false) {
        try {
            this.logger.debug("OCR attempt");
            const response = await axios.get(url, { responseType: 'arraybuffer' })
            const rawBuffer = Buffer.from(response.data);
            const { buffers, version } = await this.imageService.cutBuffer(rawBuffer);
            if(version === "en" || version === "jp") {
                const tesseractData = await this.tesseract.detectFromBuffer(buffers, version);
                const preparedData = this.prepareResults(tesseractData);
                return await this.inferData(preparedData, possibleSongNames, assignment);
            }
            if(version === "jpcoop") {
                const tesseractData = await this.tesseract.detectFromCoopBuffers(buffers, version);
                const preparedData = this.prepareResultsCoop(tesseractData);
                return await this.inferDataCoop(preparedData, possibleSongNames);
            }
        }
        catch(e) {
            this.logger.info("TesseractOCR error, aborting task" + e);
            return undefined;
        }
    }

    public async urlIntoEmbed(url: string, possibleSongNames: string | null, playerName="", assignment = false) : Promise<EmbedBuilder | undefined> {
        const data = await this.urlIntoData(url, possibleSongNames, assignment);
        if(data === undefined) 
            return;

        const { version, dataSolo, dataCoop } = data;
        if(version === "solo") {
            if(dataSolo === undefined)
                return;

            const { result: scoreResult, constant, diff, accuracy, scoreNumbers, songData } = dataSolo;
            if(assignment)
                await this.googleService.addScoreDataAssignment(dataSolo, playerName);
            return this.embedService.generateScoreEmbed(scoreResult, constant, diff, accuracy, scoreNumbers, songData.name, songData.difficulty, false);
        }
        if(version === "coop") {
            if(dataCoop === undefined)
                return;

            this.logger.debug(JSON.stringify(dataCoop));
            return this.embedService.generateCoopEmbed(dataCoop);
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
        this.logger.debug(accuracyData.text);
        const accuracy = accuracyData.text.split('\n').map(_ => parseInt(_)).filter(_ => isFinite(_));
      
        this.logger.debug(`${title} [${accuracy}] (conf: ${accuracyData.confidence}) \n`);

        return { title: title, scoreNumbers: accuracy };
    }

    private prepareResultsCoop(blocks: {
        nicknameBlocks: RecognizeResult[];
        difficultyBlocks: RecognizeResult[];
        accuracyBlocks: RecognizeResult[];
    }) {
        const nickBlocksArray = blocks.nicknameBlocks.map(a => ({ "text": a.data.text, "confidence": a.data.confidence }));
        const diffBlocksArray = blocks.difficultyBlocks.map(a => ({ "text": a.data.text, "confidence": a.data.confidence }));
        const accBlocksArray =  blocks.accuracyBlocks.map(a => ({ "text": a.data.text, "confidence": a.data.confidence }));

        const scoreArray = [];
        for(let i = 0; i < 5; i++) {
            let player, diff, acc;

            let nickElement = nickBlocksArray[i];
            let diffElement = diffBlocksArray[i];
            let accElement = accBlocksArray[i];

            if(accElement.confidence === 0)
                continue;
            
            if(nickElement.confidence > 30)
                player = nickElement.text.trim();
            else
                player = null;

            if(diffElement.confidence > 80)
                diff = diffElement.text.trim();
            else
                diff = null;

            acc = accElement.text.split('\n')
                .map(_ => _.trim())
                .filter(_ => _.length > 0)
                .map(_ => parseInt(_));

            if(acc.length !== 5)
                continue;

            scoreArray.push({
                player: player,
                difficulty: diff,
                accuracyArray: acc,
                accuracyConfidence: accElement.confidence
            })
        }
        return scoreArray;
    }

    private async inferData(data: {title: string, scoreNumbers: number[]}, possibleSongNames: string | null, assignment=false) {
        const { title, scoreNumbers } = data;
        const notecount = scoreNumbers.reduce((acc, i) => acc+i);
        const accuracy = this.calculationService.calculateAccuracy(scoreNumbers)

        const songNames = (assignment) ? await this.googleService.getCurrentAssignment() : possibleSongNames;
        let songData = await this.songDataService.findOCRWithoutDiff(title.trim(), notecount, songNames);
        if(songData === undefined) 
            return;
            
        const { constant, noteCount } = songData;
        const calculation = this.calculationService.calculateScore(constant, scoreNumbers.join("/"), noteCount);
        if(calculation === undefined)
            return;

        const { result, diff } = calculation;
        return {
            version: "solo",
            dataSolo: { result, constant, diff, accuracy, scoreNumbers, songData },
            dataCoop: undefined
        }
    }

    private async inferDataCoop(data: {
        player: string | null;
        difficulty: string | null;
        accuracyArray: number[],
        accuracyConfidence: number
    }[], possibleSongNames: string | null) {

        // get song name from notecount+diff
        let pairMap = new Map<string, [number, number]>();

        for(const item of data) {
            const { difficulty, accuracyArray, accuracyConfidence } = item;
            if(difficulty === null || accuracyArray.length !== 5)
                continue;

            const notecount = accuracyArray.reduce((acc, val) => acc + val);
            
            this.logger.debug(difficulty + " " + notecount + " " + accuracyConfidence);

            if(!pairMap.get(difficulty)) {
                pairMap.set(difficulty, [notecount, accuracyConfidence]);
               
            }
            else {
                const oldPair = pairMap.get(difficulty)!;
                if(oldPair[1] < accuracyConfidence)
                    pairMap.set(difficulty, [notecount, accuracyConfidence]);
            }
        }

        const preparedMap = Array.from(pairMap).map(([key, val]) => ({ difficulty: key, noteCount: val[0] }))
        const songData = await this.songDataService.findOCRWithDiff(preparedMap, possibleSongNames);
        if(songData === undefined)
            return;

        // calculate scores for each result
        const scoreArray = [];
        this.logger.debug(JSON.stringify(songData));
        this.logger.debug(JSON.stringify(data));
        for(const item of data) {
            const constants = songData.find(_ => _.difficulty.toUpperCase() === item.difficulty?.toUpperCase());
            if(constants === undefined)
                continue;

            const { constant, noteCount } = constants;
            const calculation = this.calculationService.calculateScore(constant, item.accuracyArray.join("/"), noteCount);
            if(calculation === undefined)
                return;

            scoreArray.push({
                result: calculation.result,
                diff: calculation.diff,
                accuracy: calculation.accuracy,
                scoreValues: calculation.scoreValues,

                songData: constants,
                player: item.player,
                difficulty: item.difficulty,
                accuracyConfidence: item.accuracyConfidence
            });
        }

        // return list of scores
        return {
            version: "coop",
            dataSolo: undefined,
            dataCoop: scoreArray
        }
    }
}