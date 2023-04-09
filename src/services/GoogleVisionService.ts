import { DissonanceLogger, Service } from '@antaresque/dissonance';
import { ImageAnnotatorClient} from '@google-cloud/vision';
import { CalculationService } from './CalculationService';

@Service()
export class GoogleVisionService {

    constructor(private readonly calculationService: CalculationService, private readonly logger: DissonanceLogger) { }

    // detect the text in an image
    public static async detectText(image: string): Promise<any[]> {
        const client = new ImageAnnotatorClient();
        const [result] = await client.textDetection(image);
        const detections = result.textAnnotations;
        if(detections && detections.length > 0)
            return detections;
        else
            return [];
    }

    public analyzeData(data: any[]) {
        const withinRange = (value: number, target: number, range: number) => {
            return value >= target - range && value <= target + range;
        }
    
        let song: string[] = [];
        let songLineHeight = undefined;
        let difficultyLineHeight = undefined;
        let perfectXEnd = undefined;
        let difficulty = "";
        let scoreDataNum: {
            [key: string]: number | undefined
        } = {
            "perfect": undefined,
            "great": undefined,
            "good": undefined,
            "bad": undefined,
            "miss": undefined,
        }
    
        const difficulties = ["easy", "normal", "hard", "expert", "master"];
        const accuracyLineHeight: {
            [key: string]: number[] | undefined
        } = {
            "perfect": undefined,
            "great": undefined,
            "good": undefined,
            "bad": undefined,
            "miss": undefined
        }
    
        let bottomRightOfImage = data[0].boundingPoly.vertices[2];
        // 30% of image length
        let imageLengthLimit = bottomRightOfImage.x * 0.6;
    
        for(let single of data.slice(1)) {
            let topLeft = single.boundingPoly.vertices[0];
            let bottomRight = single.boundingPoly.vertices[2];
    
            // find difficulty in left half of image, at 200px from top
            if(topLeft.x < imageLengthLimit && topLeft.y < 220) {
                if(difficulties.includes(single.description.toLowerCase())) {
                    difficulty = single.description;
                    this.logger.info(`difficulty found: ${single.description}`);
                    
                    // save the x position of the difficulty
                    difficultyLineHeight = topLeft.x;
                    continue;
                }
            }
    
            // find accuracy by finding accuracy words
            if(single.description.toLowerCase() in accuracyLineHeight) {
                accuracyLineHeight[single.description.toLowerCase()] = [topLeft.y, bottomRight.y];
                this.logger.info(`accuracyLineHeight: ${single.description.toLowerCase()}: ${accuracyLineHeight[single.description.toLowerCase()]}`);
                continue;
            }
        }
    
        for(let single of data.slice(1)) {
            // find score data
            let topLeft = single.boundingPoly.vertices[0];
            let bottomRight = single.boundingPoly.vertices[2];
    
            // find song name in left half of image, at 100px from top
            if(topLeft.x >= difficultyLineHeight-50 && topLeft.x < imageLengthLimit && topLeft.y < 130) {
                if(songLineHeight === undefined) {
                    songLineHeight = [topLeft.y, bottomRight.y];
                    this.logger.info(`songLineHeight: ${songLineHeight}`);
                }
    
                if(withinRange(topLeft.y, songLineHeight[0], 20) && withinRange(bottomRight.y, songLineHeight[1], 20)) {
                    song.push(single.description);
                    this.logger.info(`title found: ${single.description}`);
                    continue;
                }
            }
    
            // find perfects 
            const diff = "perfect";
            if(withinRange(topLeft.y, accuracyLineHeight[diff]![0], 20) && withinRange(bottomRight.y, accuracyLineHeight[diff]![1], 20)) {
                let number = parseInt(single.description);
                if(isNaN(number) || scoreDataNum[diff] !== undefined)
                    continue;
                scoreDataNum[diff] = number;
                perfectXEnd = bottomRight.x;
                this.logger.info(`scoreDataNum: ${diff}: ${scoreDataNum[diff]}`);
            }
            
        }
    
        for(let single of data.slice(1)) {
            // find rest of score data
            let topLeft = single.boundingPoly.vertices[0];
            let bottomRight = single.boundingPoly.vertices[2];
    
            for(let diff of Object.keys(accuracyLineHeight).slice(1)) {
                if(withinRange(bottomRight.x, perfectXEnd, 20) && withinRange(topLeft.y, accuracyLineHeight[diff]![0], 20) && withinRange(bottomRight.y, accuracyLineHeight[diff]![1], 20)) {
                    let number = parseInt(single.description);
                    if(isNaN(number) || scoreDataNum[diff] !== undefined)
                        continue;
                    scoreDataNum[diff] = number;
                    this.logger.info(`scoreDataNum: ${diff}: ${scoreDataNum[diff]}`);
                    
                    break;
                }
            }
        }
    
        let accCalc = -1;
        // if all scores are found
        if(Object.values(scoreDataNum).every(a => a !== undefined)) {
            accCalc = this.calculationService.calculateAccuracy(Object.values(scoreDataNum) as number[]);
        }
    
        const title = song.join(" ");
        this.logger.info(title);
        return {
            title,
            difficulty,
            accuracy: accCalc,
            scoreDataNum: [scoreDataNum.perfect!, scoreDataNum.great!, scoreDataNum.good!, scoreDataNum.bad!, scoreDataNum.miss!]
        }
    }
    
}