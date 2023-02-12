import { GoogleDataService } from './GoogleDataService';
import { Service } from "@antaresque/dissonance";

@Service()
export class SongDataService {
    constructor(private google: GoogleDataService) { }

    public async find(name: string | null, diff: string | null) {
        if(name === null || diff === null)
            return undefined;

        return (await this.findByName(name))?.find(data => data.difficulty === diff);
    }

    public async findByName(name: string | null) {
        if(name === null)
            return undefined;

        return (await this.google.getConstants()).filter(data => name === data.name || data.aliases.includes(name));
    }

    public async getChartData() {
        return await this.google.getConstants();
    }

    public async getSongNames() {
        const constants = await this.google.getConstants();
        const names = constants.map(chart => chart.name);
        const aliases = constants.map(chart => chart.aliases).flat();

        return [...new Set([...names, ...aliases])];
    }

    public getSongDifficulties() {
        return ["Hard", "Expert", "Master"];
    }
}