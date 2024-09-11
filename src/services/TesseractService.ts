import { Service } from "@antaresque/dissonance";
import { createWorker, PSM, Worker } from 'tesseract.js';

const OVERWORK_COUNT = 5000; // amount of OCR jobs before reboot

@Service()
export class TesseractService { 
    private isAlive = false;
    private currentCount = 0;
    private workerEnglish!: Worker;
    private workerJapanese!: Worker;
    private workerDigits!: Worker; // digits

    constructor() { }

    public async checkTesseractWorkers() {
        if(this.isAlive && this.currentCount > OVERWORK_COUNT) 
            await this.terminateWorkers();
        
        if(!this.isAlive) 
            await this.initializeWorkers();
    }  

    public async terminateWorkers() {
        await this.workerEnglish.terminate();
        await this.workerJapanese.terminate();
        await this.workerDigits.terminate();
    }

    public async initializeWorkers() {
        this.workerEnglish  = await createWorker('eng');
        this.workerJapanese = await createWorker('jpn');
        this.workerDigits   = await createWorker();

        await this.workerEnglish.setParameters({
            "tessedit_pageseg_mode": PSM.AUTO,
            "user_defined_dpi": "71" 
        });
        await this.workerJapanese.setParameters({
            "tessedit_pageseg_mode": PSM.AUTO_ONLY,
            "user_defined_dpi": "71" 
        });
        await this.workerDigits.setParameters({
            "tessedit_pageseg_mode": PSM.AUTO,
            "tessedit_char_whitelist": "0123456789",
            "user_defined_dpi": "71" 
        });
    }

    public async detectFromBuffer(buffers: {titleImage: Buffer, accuracyImage: Buffer}, version: "en" | "jp") {
        await this.checkTesseractWorkers();

        const mainData = (version === "en") 
            ? await this.workerEnglish.recognize(buffers.titleImage) 
            : await this.workerJapanese.recognize(buffers.titleImage);

        const secondaryData = (version === "en") 
            ? null
            : await this.workerEnglish.recognize(buffers.titleImage);

        const accuracyData = await this.workerDigits.recognize(buffers.accuracyImage);

        this.currentCount++;

        return { mainData, secondaryData, accuracyData }
    }
}
