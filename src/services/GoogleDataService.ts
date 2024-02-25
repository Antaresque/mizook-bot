import { ConstantRecord } from './../types';
import { DissonanceLogger, Service } from "@antaresque/dissonance";
import { google } from "googleapis";
import { ChartData } from "../types";

const DEFAULT_SERVER = '980783169735364658';
@Service()
export class GoogleDataService {
    private _constants: Record<string, ConstantRecord> = {};

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
