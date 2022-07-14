export type Difficulty = "Hard" | "Expert" | "Master";

export class ChartData {
    name: string;
    difficulty: Difficulty;
    constant: number;
    noteCount: number;

    constructor(n: string, d: Difficulty, c: number, nc: number) {
        this.name = n;
        this.difficulty = d;
        this.constant = c;
        this.noteCount = nc;
    }
}

export type TourneyResult = {
    playerName: string,
    scores: TourneyScore[]
}

export type TourneyScore = {
    song: string,
    result: string,
    rank: string,
    difficulty: string,
    constant: string,
    score: string,
    accuracy: string
}