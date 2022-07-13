import { DissonanceLogger, Service } from "@antaresque/dissonance";

@Service()
export class CalculationService {
    constructor(private logger: DissonanceLogger) {}

    public calculateScore(constant: number, score: string, noteCount: number) {
        const scoreData = score.split('/');
      
        if(scoreData.length > 5 || scoreData.length < 1)
          return undefined;
      
        const scoreValues = this.convertToScoreValues(scoreData, noteCount);
        if(scoreValues === undefined)
          return undefined;
      
        const accuracy = this.calculateAccuracy(scoreValues);
        const constantModifier = this.getModifierFromAccuracy(accuracy);
        if(constantModifier === undefined)
            return undefined;
      
        const result = constant + constantModifier;
        const diff = ((constantModifier > 0) ? "+" : "") + `${constantModifier.toFixed(2)}`
      
        return { result, diff, accuracy, scoreValues };
    }

    convertToScoreValues(score: string[], noteCount: number) {
        if(score.length === 5) {
            return score.map(s => parseInt(s));
          }
        
          if(score.length > 0) {
            const arr = score.map(s => parseInt(s));
            const great = arr[0];
            const good = arr[1] ?? 0;
            const bad = arr[2] ?? 0;
            const miss = arr[3] ?? 0;
        
            return [
              noteCount - great - good - bad - miss,
              great, good, bad, miss
            ]
          }
        
          return undefined;
    }

    calculateAccuracy(score: number[]) {
        const totalNoteAmount = score.reduce((acc, a) => acc + a, 0);
  
        const perf = score[0];
        const great = score[1];
        const good = score[2];
        const bad = score[3];
        const miss = score[4];

        const negative = great + good*2 + bad*3 + miss*3;
        const accuracy = (totalNoteAmount*3 - negative) / (totalNoteAmount*3);

        return accuracy;
    }

    getModifierFromAccuracy(accuracy: number) {
        if(accuracy > 1.00)
          return undefined;
      
        if(accuracy >= 0.99) {
          const diff = accuracy-0.99;
          return diff * 200 + 2;
        }
        else if(accuracy < 0.99 && accuracy >= 0.97){
          const diff = accuracy-0.97;
          return diff * 100;
        }
        else {
          const diff = accuracy-0.97;
          return diff * 200 / 3;
        }
    }
}