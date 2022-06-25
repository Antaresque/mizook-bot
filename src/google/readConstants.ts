import { google } from "googleapis";
import 'dotenv/config';

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

export const readConstants = async () => {
    try {
        const secret = process.env.GOOGLE_SECRET ?? "";
        const auth = google.auth.fromAPIKey(secret);
        const sheets = google.sheets({version: 'v4', auth});

        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: '1egidbEhq40Zf0NNYzHBXIAZg4Nj0Wi867DOgOR70cIY',
          range: 'Constants!A2:E1000',
        });

        const { values } = response.data;

        console.log(values);

        if(values === undefined)
            return [];

        return values.map<ChartData>(value => {
            return new ChartData(
                value[0],
                value[3],
                parseFloat(value[1]),
                parseInt(value[4]),
            );
        })
    }
    catch(err){
        console.log('Error loading client secret file:', err);
    }
}