import { GoogleDataService } from './GoogleDataService';
import { DissonanceLogger, Service } from "@antaresque/dissonance";
import { levenshtein } from '../util/levenshtein';
import { ChartData } from 'src/types';

@Service()
export class SongDataService {
    constructor(private google: GoogleDataService, private logger: DissonanceLogger) { }

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
        return ["Hard", "Expert", "Master", "Append"];
    }

    // deprecated
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

    public async findOCRForAssignment(name: string | null, noteCount: number | null) {
        const assignmentQuery = await this.google.getCurrentAssignment();
        return await this.findOCRWithoutDiff(name, noteCount, assignmentQuery);
    }

    public async findOCRWithoutDiff(name: string | null, noteCount: number | null, possibleSongNames: string | null) {
        if(name === null || noteCount === null)
            return undefined;

        const songNameLimit = possibleSongNames?.split(";");

        const constants = await this.google.getConstants(null);
        // find by noteCount and diff
        const byNoteCount = constants.filter(data => data.noteCount === noteCount);

        if(byNoteCount.length === 1)
            return byNoteCount[0];

        if(byNoteCount.length === 0)
            return undefined;

        if(songNameLimit !== undefined && songNameLimit.length > 0) {
            // filter based on limit
            const filteredBySong = byNoteCount.filter(data => songNameLimit.some(_ => data.name.includes(_) || data.aliases.some(x => x.includes(_))));
            if(filteredBySong.length === 1)
                return filteredBySong[0];
            if(filteredBySong.length === 0)
                return undefined;

            const preparedTitle = name.replace(/\s+/g, '');
            const diffMap: Array<[ChartData, number]> = filteredBySong.map(_ => [_, levenshtein()(preparedTitle, _.name.replace(/\s+/g, ''))]);
            const bestMatch = diffMap.reduce((best, current) => best[1] > current[1] ? best : current);
            return bestMatch[0];
        }
        else {
            const preparedTitle = name.replace(/\s+/g, '');
            const diffMap: Array<[ChartData, number]> = byNoteCount.map(_ => [_, levenshtein()(preparedTitle, _.name.replace(/\s+/g, ''))]);
            const bestMatch = diffMap.reduce((best, current) => best[1] > current[1] ? best : current);
            return bestMatch[0];
        }

    }

    public async findOCRWithDiff(array: {difficulty: string, noteCount: number}[], possibleSongNames: string | null) {
        if(array.length === 0)
            return;

        const constants = await this.google.getConstants(null);
        const songNameLimit = possibleSongNames?.split(";");
        // find by noteCount and diff
        const results: ChartData[][] = [];
        for(let { difficulty, noteCount } of array) {
            const byNoteCount = constants.filter(data => noteCount === data.noteCount && difficulty.toUpperCase() === data.difficulty.toUpperCase());
            results.push(byNoteCount);
        }       

        const names = results.map(_ => _.map(_ => _.name));
        if(names.length === 0)
            return;

        const intersectingValues = names.reduce((acc, array) => this.intersect(acc, array));
        if(intersectingValues.length === 1)
            return constants.filter(data => data.name === intersectingValues[0]);

        if(songNameLimit !== undefined && songNameLimit.length > 0) {
            // filter based on limit
            const filteredBySong = intersectingValues.filter(_ => songNameLimit.some(limit => limit === _))
            if(filteredBySong.length === 1)
                return constants.filter(data => data.name === filteredBySong[0]);
            if(filteredBySong.length === 0)
                return undefined;
        }
        else return constants.filter(data => data.name === intersectingValues[0]);
    }

    private intersect(a: string[], b: string[]) {
        var setA = new Set(a);
        var setB = new Set(b);
        var intersection = new Set([...setA].filter(x => setB.has(x)));
        return Array.from(intersection);
      }
}