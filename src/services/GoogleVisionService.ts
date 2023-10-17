import { DissonanceLogger, Service } from '@antaresque/dissonance';
import { ImageAnnotatorClient} from '@google-cloud/vision';
import { CalculationService } from './CalculationService';

const withinRange = (value: number, target: number, range: number) => {
    return value >= target - range && value <= target + range;
}
const DIFFICULTIES = ["easy", "normal", "hard", "expert", "master"];
const ACC_WORDS = ["perfect", "great", "good", "bad", "miss"];

type DataCoop = {
    [key: string]: number | undefined
};

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

    public analyzeData(annotations: any[]) {
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
    
        const accuracyLineHeight: {
            [key: string]: number[] | undefined
        } = {
            "perfect": undefined,
            "great": undefined,
            "good": undefined,
            "bad": undefined,
            "miss": undefined
        }
    
        let bottomRightOfImage = annotations[0].boundingPoly.vertices[2];
        // 30% of image length
        let imageLengthLimit = bottomRightOfImage.x * 0.6;
    
        for(let single of annotations.slice(1)) {
            let topLeft = single.boundingPoly.vertices[0];
            let bottomRight = single.boundingPoly.vertices[2];
    
            // find difficulty in left half of image, at 200px from top
            if(topLeft.x < imageLengthLimit && topLeft.y < 220) {
                if(DIFFICULTIES.includes(single.description.toLowerCase())) {
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
    
        for(let single of annotations.slice(1)) {
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
    
        for(let single of annotations.slice(1)) {
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

    public analyzeDataCoop(annotations: any[]) {
        const songTitle: string[] = [];
        const names: string[] = [];
        const scoreDataNum: DataCoop[] = [];

        const _difficulties: {difficulty:string, x:number, y:number}[] = [];
        const _names: {name:string, x:number, xEnd: number, y:number}[] = [];

        const lineHeight: {
            [key: string]: number[] | undefined
        } = {
            "song": undefined,
            "perfect": undefined,
            "great": undefined,
            "good": undefined,
            "bad": undefined,
            "miss": undefined
        }
    
        let bottomRightOfImage = annotations[0].boundingPoly.vertices[2];
        // 30% of image length
        // let imageLengthLimit = bottomRightOfImage.x * 0.6;
        console.log(ACC_WORDS);
    
        for(const data of annotations.slice(1)) {
            const topLeft = data.boundingPoly.vertices[0];
            const bottomRight = data.boundingPoly.vertices[2];

            // find all text in the top 30%
            const _name = this.findNameCoop(data, bottomRightOfImage);
            if(_name !== undefined) {
                _names.push(_name);
            }

            // find all difficulty-related keywords
            const _diff = this.findDifficultyCoop(data, bottomRightOfImage); 
            if(_diff !== undefined) {
                _difficulties.push(_diff);
                continue;
            }

            // find all accuracy-related keywords
            if(ACC_WORDS.includes(data.description.trim().toLowerCase())) {
                lineHeight[data.description.trim().toLowerCase()] = [topLeft.y, bottomRight.y];
                this.logger.info(`accuracyLineHeight: ${data.description.trim().toLowerCase()}: ${lineHeight[data.description.trim().toLowerCase()]}`);
            }
        }
    
        for(const data of annotations.slice(1)) {
            const topLeft = data.boundingPoly.vertices[0];
            const bottomRight = data.boundingPoly.vertices[2];

            const { _song, _songLineHeight } = this.findSong(data, _difficulties[0].x, bottomRightOfImage, lineHeight.song);
            if(_song !== undefined && _songLineHeight !== undefined) {
                songTitle.push(_song);
                lineHeight.song = _songLineHeight;
            }
    
            // find perfects 
            if(withinRange(topLeft.y, lineHeight['perfect']![0], 20) && withinRange(bottomRight.y, lineHeight['perfect']![1], 20)) {
                let number = parseInt(data.description);
                if(isNaN(number))
                    continue;
                
                scoreDataNum.push({
                    perfect: number,
                    great: undefined,
                    good: undefined,
                    bad: undefined,
                    miss: undefined
                });
    
                this.logger.info(`scoreDataNum: ${'perfect'}: ${scoreDataNum[scoreDataNum.length - 1].perfect}`);
            }
        }

        // save names where they are above the difficulties
        let lastNameX = undefined;
        for(let i = 0; i < _names.length; i++) {
            const name = _names[i];
            const y = name.y;
            const diffY = _difficulties[_difficulties.length-1].y;

            if(y < diffY-80 && y > bottomRightOfImage.y * 0.2) {
                const value = name.name;
                if(lastNameX !== undefined && withinRange(name.x, lastNameX, 40))
                    names[names.length-1] += ` ${value}`;
                else {
                    names.push(value);
                    lastNameX = name.xEnd;
                }

                this.logger.info(`name: ${name.name}`);
            }
        }
    
        for(let single of annotations.slice(1)) {
            // find rest of score data
            let topLeft = single.boundingPoly.vertices[0];
            let bottomRight = single.boundingPoly.vertices[2];
    
            for(let diff of ACC_WORDS.slice(1)) {
                if(withinRange(topLeft.y, lineHeight[diff]![0], 20) && withinRange(bottomRight.y, lineHeight[diff]![1], 20)) {
                    let number = parseInt(single.description);
                    if(isNaN(number))
                        continue;

                    for(const data of scoreDataNum) {
                        if(data[diff] === undefined) {
                            data[diff] = number;
                            break;
                        }
                    }

                    this.logger.info(`scoreDataNum: ${diff}: ${number}`);
                    
                    break;
                }
            }
        }
    
        let accCalc = [];
        // if all scores are found
        for(const data of scoreDataNum) {
            if(Object.values(data).every(a => a !== undefined)) {
                accCalc.push(this.calculationService.calculateAccuracy(Object.values(data) as number[]));
            }
        }
    
        const title = songTitle.join(" ");
        this.logger.info(title);
        return {
            title,
            names,
            difficulties: _difficulties.slice(1).map(a => a.difficulty),
            accuracy: accCalc,
            scoreDataNum: Array.from(scoreDataNum.map(a => [a.perfect!, a.great!, a.good!, a.bad!, a.miss!])),
        }
    }

    // ------------------ HELPER FUNCTIONS ------------------

    // find difficulty in left half of image, at 220px from top
    private findDifficulty(single: any, bottomRightOfImage: any): { _difficulty: string|undefined; _diffLineHeight: number|undefined; } {
        let _difficulty = undefined;
        let _diffLineHeight = undefined;

        const topLeft = single.boundingPoly.vertices[0];
        const imageLengthLimit = bottomRightOfImage.x * 0.6;

        // find difficulty in left half of image, at 200px from top
        if(topLeft.x < imageLengthLimit && topLeft.y < 220) {
            if(DIFFICULTIES.includes(single.description.toLowerCase())) {
                _difficulty = single.description;
                this.logger.info(`difficulty found: ${single.description}`);
                
                // save the x position of the difficulty
                _diffLineHeight = topLeft.x;
            }
        }

        return { _difficulty, _diffLineHeight };
    }

    // find song title
    private findSong(single: any, diffLineHeightX: number, bottomRightOfImage: any, songLineHeight: number[]|undefined): { _song: string|undefined; _songLineHeight: number[]|undefined; } {
        let _song = undefined;
        let _songLineHeight = songLineHeight;

        const topLeft = single.boundingPoly.vertices[0];
        const bottomRight = single.boundingPoly.vertices[2];
        const imageLengthLimit = bottomRightOfImage.x * 0.6;

        // find song name in left half of image, at 100px from top
        if(topLeft.x >= diffLineHeightX - 50 && topLeft.x < imageLengthLimit && topLeft.y < 130) {
            if(_songLineHeight === undefined) {
                _songLineHeight = [topLeft.y, bottomRight.y];
                this.logger.info(`songLineHeight: ${_songLineHeight}`);
            }

            if(withinRange(topLeft.y, _songLineHeight[0], 20) && withinRange(bottomRight.y, _songLineHeight[1], 20)) {
                _song = single.description;
                this.logger.info(`title found: ${single.description}`);
            }
        }

        return { _song, _songLineHeight };
    }

    // find difficulty in coop image
    private findDifficultyCoop(single: any, bottomRightOfImage: any): { difficulty: string, x: number, y: number } | undefined {
        let _difficulty = undefined;

        const topLeft = single.boundingPoly.vertices[0];
        const imageHeightLimit = bottomRightOfImage.y * 0.5;

        // find difficulty 
        if(topLeft.y < imageHeightLimit) {
            if(DIFFICULTIES.includes(single.description.toLowerCase())) {
                this.logger.info(`difficulty found: ${single.description}`);
                
                // save the y position of the difficulty
                _difficulty = {
                    difficulty: single.description,
                    x: topLeft.x,
                    y: topLeft.y
                }
            }
        }

        return _difficulty;
    }

    private findNameCoop(single: any, bottomRightOfImage: any): { name: string, x: number, xEnd: number, y: number } | undefined {
        let _name = undefined;

        const topLeft = single.boundingPoly.vertices[0];
        const bottomRight = single.boundingPoly.vertices[2];
        const imageHeightLimit = bottomRightOfImage.y * 0.3;

        // find difficulty 
        if(topLeft.y < imageHeightLimit) {
            this.logger.info(`text found: ${single.description}`);
            
            // save the y position of the difficulty
            _name = {
                name: single.description,
                x: topLeft.x,
                xEnd: bottomRight.x,
                y: topLeft.y
            }
        }
        
        return _name;
    }
}