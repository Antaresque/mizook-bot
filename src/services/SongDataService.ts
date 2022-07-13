import { GoogleDataService } from './GoogleDataService';
import { Service } from "@antaresque/dissonance";

@Service()
export class SongDataService {
    constructor(private google: GoogleDataService) { }

    public async find(name: string | null, diff: string | null) {
        if(name === null || diff === null)
            return undefined;

        return (await this.google.getConstants()).find(data => name === data.name && diff === data.difficulty);
    }

    public async getChartData() {
        return await this.google.getConstants();
    }

    public async getSongNames() {
        const constants = await this.google.getConstants();
        return [...new Set(constants.map(chart => chart.name))];
    }

    public getSongDifficulties() {
        return ["Hard", "Expert", "Master"];
    }
}