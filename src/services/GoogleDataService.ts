import { DissonanceLogger, Service } from "@antaresque/dissonance";
import { google } from "googleapis";
import { ChartData } from "../types";

@Service()
export class GoogleDataService {
    private _constants: ChartData[] = [];
    private _lastModified: number = -1;

    constructor(private logger: DissonanceLogger) {}

    public async getConstants() {
        this.logger.log("getConstants request");

        await this.updateConstants();
        return this._constants;
    }
    
    private async updateConstants() {
        // updates constants every 30 minutes
        const THIRTY_MINUTES = 1000 * 60 * 30;
        const current = Date.now();
      
        if(this._lastModified + THIRTY_MINUTES > current)
          return;
      
        this.logger.log("updateConstants, updating constants");
        this._lastModified = Date.now();
        this._constants = await this.readConstants();
    }

    private async readConstants() {
        try {
            const secret = process.env.GOOGLE_SECRET ?? "";
            const auth = google.auth.fromAPIKey(secret);
            const sheets = google.sheets({version: 'v4', auth});
    
            const response = await sheets.spreadsheets.values.get({
              spreadsheetId: '1zDnltetKoyL1WukubSmyPRaA06z_HQqp_uaaaml0Igs',
              range: 'Constants!A2:G1000',
            });
    
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
            console.log('Error loading client secret file:', err);
            return [];
        }
    }
}