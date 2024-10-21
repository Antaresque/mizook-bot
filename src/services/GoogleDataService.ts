import { ConstantRecord, TourneyScore } from './../types';
import { DissonanceLogger, Service } from "@antaresque/dissonance";
import { Auth, google } from "googleapis";
import { ChartData } from "../types";

const DEFAULT_SERVER = '980783169735364658';
const DUMP_SHEET = "1WzJ1K60VJQ2ofRWQra6iD3UXougpyTpd8ZnDXq6uRXE";

@Service()
export class GoogleDataService {
    private _constants: Record<string, ConstantRecord> = {};
    private _assignmentQuery: {assignmentNo: string, query: string, lastModified: number} = { assignmentNo: "", query: "", lastModified: 0};

    constructor(private logger: DissonanceLogger) {}

    public async getConstants(serverId: string | null) {
        this.logger.info("getConstants request");

        const server = serverId ?? DEFAULT_SERVER;

        await this.updateConstants(server);
        return this._constants[server].data;
    }
    
    private async updateConstants(server: string) {
        const serverData = this._constants[server];

        // updates constants every 30 minutes
        const UPDATE_DELAY = process.env.UPDATE_DELAY ? parseInt(process.env.UPDATE_DELAY) : 1000 * 60 * 30;
        const current = Date.now();
      
        if(serverData !== undefined && serverData.lastModified + UPDATE_DELAY > current)
          return;
      
        this.logger.info("updateConstants, updating constants");
        const newServerData = {
            lastModified: Date.now(),
            data: await this.readConstants(server)
        }

        if(newServerData.data.length > 0)
            this._constants[server] = newServerData;
    }

    private async readConstants(server: string) {
        try {
            const spreadsheetLocation = this.getSpreadsheetByServer(server);

            const secret = process.env.GOOGLE_SECRET ?? "";
            const auth = google.auth.fromAPIKey(secret);
            const sheets = google.sheets({version: 'v4', auth});
    
            const response = await sheets.spreadsheets.values.get(spreadsheetLocation);
    
            const { values } = response.data;
    
            if(values === undefined || values === null)
                return [];
    
            return values.map<ChartData>(value => {
                let aliases: string[] = [];

                if(value.length > 6)
                    aliases = value[6].split(";").map((a : string) => a.trim());

                return new ChartData(
                    value[0],
                    value[3],
                    parseFloat(value[1]),
                    parseInt(value[4]),
                    aliases,
                );
            })
        }
        catch(err) {
            this.logger.info('Error loading client secret file:');
            return [];
        }
    }

    // ------

    public async getCurrentAssignment() {
        await this.updateCurrentAssignment();
        return this._assignmentQuery.query;
    }
    
    private async updateCurrentAssignment() {
        const query = this._assignmentQuery;

        // updates constants every 30 minutes
        const UPDATE_DELAY = process.env.UPDATE_DELAY ? parseInt(process.env.UPDATE_DELAY) : 1000 * 60 * 30;
        const current = Date.now();
      
        if(query.lastModified + UPDATE_DELAY > current)
          return;

        const values = await this.readCurrentAssignment();
      
        this._assignmentQuery = {
            lastModified: Date.now(),
            query: values[1],
            assignmentNo: values[0]
        }

        console.log(this._assignmentQuery);
    }

    private async readCurrentAssignment() {
        try {
            const secret = process.env.GOOGLE_SECRET ?? "";
            const auth = google.auth.fromAPIKey(secret);
            const sheets = google.sheets({version: 'v4', auth});
    
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: DUMP_SHEET,
                range: 'Songs!A1:B1' 
            });
    
            const { values } = response.data;
    
            if(values === undefined || values === null)
                return [];
    
            return values[0];
        }
        catch(err) {
            this.logger.info('Error loading client secret file:');
            return [];
        }
    }


    public async addScoreDataAssignment(dataSolo: { result: number; constant: number; diff: string; accuracy: number; scoreNumbers: number[]; songData: ChartData; }, discriminator: string) {
        const credentials = process.env.GOOGLE_CREDENTIALS ?? "";
        const auth = new Auth.GoogleAuth({
            credentials: JSON.parse(credentials),
            scopes: "https://www.googleapis.com/auth/spreadsheets",
        });
        const sheets = google.sheets({version: 'v4', auth});

        const { result, constant, diff, accuracy, scoreNumbers, songData } = dataSolo;
        await this.updateCurrentAssignment(); 

        const valueArray: string[][] = [[
            this._assignmentQuery.assignmentNo, discriminator, songData.name, songData.difficulty, scoreNumbers[1].toString(), scoreNumbers[2].toString(), scoreNumbers[3].toString(), scoreNumbers[4].toString(), constant.toString(), diff, result.toString(), accuracy.toString()
        ]];
        

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: DUMP_SHEET,
            range: "Scores!A:A",
            valueInputOption: "USER_ENTERED",
            requestBody: {
                range: "Scores!A:A",
                values: valueArray
            }    
        });
    }

    public async addScoreData(dataCoop: { result: number; diff: string; accuracy: number; scoreValues: number[]; songData: ChartData; player: string | null; difficulty: string | null; accuracyConfidence: number; }[]) {        
        const secret = process.env.GOOGLE_SECRET ?? "";
        const auth = google.auth.fromAPIKey(secret);
        const sheets = google.sheets({version: 'v4', auth});

        const name = dataCoop[0].songData.name;
        const valueArray = [];

        for(const item of dataCoop) {
            const player = item.player ?? "";
            const difficulty = item.difficulty ?? "";
            const scoreValues = item.scoreValues;
            valueArray.push([
                Date.now(), player, name, difficulty, scoreValues[1], scoreValues[2], scoreValues[3], scoreValues[4]
            ])
        }

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: DUMP_SHEET,
            range: "dump",
            valueInputOption: "USER_ENTERED",
            requestBody: {
                range: "dump",
                values: valueArray
            }    
        });
    }

    private getSpreadsheetByServer(server: string) {
        switch(server) {
            case "980783169735364658": //cc
                return {
                    spreadsheetId: "1egidbEhq40Zf0NNYzHBXIAZg4Nj0Wi867DOgOR70cIY",
                    range: 'Constants!A2:G5000' 
                }
            case "986099686005960796": //39s
                return {
                    spreadsheetId: "1GMbeExLzQcSH41fBBSFxx-ZFPZk7BfLHS8_62iMnfyc",
                    range: 'Constants!A2:G5000' 
                }
            case "109791028801753088": //test
                return {
                    spreadsheetId: "1GMbeExLzQcSH41fBBSFxx-ZFPZk7BfLHS8_62iMnfyc",
                    range: 'Constants!A2:G5000' 
                }
            default:
                return {
                    spreadsheetId: "1egidbEhq40Zf0NNYzHBXIAZg4Nj0Wi867DOgOR70cIY",
                    range: 'Constants!A2:G5000' 
                }
        }
    }
}
