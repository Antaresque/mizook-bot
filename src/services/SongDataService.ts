import { GoogleDataService } from './GoogleDataService';
import { Service } from "@antaresque/dissonance";

@Service()
export class SongDataService {
    constructor(private google: GoogleDataService) { }

    public async find(name: string | null, diff: string | null, serverId: string | null = null) {
        if(name === null || diff === null)
            return undefined;

        return (await this.findByName(name, serverId))?.find(data => data.difficulty === diff);
    }

    public async findByName(name: string | null, serverId: string | null = null) {
        if(name === null)
            return undefined;

        return (await this.google.getConstants(serverId)).filter(data => name === data.name || data.aliases.includes(name));
    }

    public async getChartData(serverId: string | null = null) {
        return await this.google.getConstants(serverId);
    }

    public async getSongNames(serverId: string | null = null) {
        const constants = await this.google.getConstants(serverId);
        const names = constants.map(chart => chart.name);
        const aliases = constants.map(chart => chart.aliases).flat();

        return [...new Set([...names, ...aliases])];
    }

    public getSongDifficulties() {
        return ["Hard", "Expert", "Master"];
    }

    public async findOCR(name: string | null, diff: string | null, noteCount: number | null) {
        if(name === null || diff === null || noteCount === null)
            return undefined;

        const constants = await this.google.getConstants(null);
        // find by noteCount and diff
        const byNoteCount = constants.filter(data => data.noteCount === noteCount && data.difficulty === diff);

        if(byNoteCount.length === 1)
            return byNoteCount[0];

        const noWSname = name.replace(/[^a-z0-9]/gi, '');
        return byNoteCount.find(data => data.name.replace(/[^a-z0-9]/gi, '') === noWSname || data.aliases.map(t => t.replace(/[^a-z0-9]/gi, '')).includes(noWSname));
    }
}