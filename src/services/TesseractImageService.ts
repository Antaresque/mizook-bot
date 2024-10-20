import { Service } from "@antaresque/dissonance";
import sharp from 'sharp';

const COLOURS = {
  jp_coop: {r: [89,0], g: [90,0], b: [121,0]},
  jp: {r: [175,25], g: [175,25], b: [200,40]},
  en: {r: [75,25], g: [75,25], b: [100,40]}
}

const withinRange = (value: number, target: number, range: number) => {
  return value >= target - range && value <= target + range;
}

@Service()
export class TesseractImageService {

    public async cutBuffer(file: Buffer) {
        sharp.concurrency(1);

        const version = await this.checkVersion(file);
        if(version === "jp" || version === "en")
          return this.cutBufferSolo(version, file);
        if(version === "jpcoop")
          return this.cutBufferCoop(version, file);
        
        throw new Error("TesseractImageService, undetected version");
    }

    public async cutBufferSolo(version: "en" | "jp", file: Buffer) {
      let image = sharp(file).removeAlpha();
      
      const { width, height } = await image.metadata();
      const options = await this.getOptions(version, width, height);
      
      let title = image.extract(options.song).threshold();
      if(version === "en")
          title = title.negate();
      title = title.extend(4);
      const titleBuffer = await title.toBuffer();
      
      image = sharp(file).removeAlpha();
      const acc = image.extract(options.acc)
          .resize(600)
          .threshold()
          .negate()
          .extend(4);
      const accuracyBuffer = await acc.toBuffer();

      return {
        buffers: { titleImage: titleBuffer, accuracyImage: accuracyBuffer },
        version: version 
      };
    }

    // this works only for jp now
    public async cutBufferCoop(version: "jpcoop", file: Buffer) {
      let temporaryBuffer: Buffer;

      let image = sharp(file).removeAlpha();
      const { width, height } = await image.metadata();
      const options = this.getOptionsForCoop(version, width, height);

      // nicknames
      const nicknames = image.extract(options.name).threshold(192).negate();
      temporaryBuffer = await nicknames.toBuffer();
      const nicknameBuffers = [];
      for(let i = 0; i < 100; i += 20) { 
        const newBuffer = await sharp(temporaryBuffer)
          .extract({top: 0, height: options.name.height, left: Math.floor(i * 0.01 * options.name.width), width: Math.floor(0.2 * options.name.width)})
          .extend(4)
          .toBuffer();
        nicknameBuffers.push(newBuffer);
      }

      // difficulties
      image = sharp(file).removeAlpha();
      const difficulties = await image.extract(options.diff).threshold(220).negate();
      temporaryBuffer = await difficulties.toBuffer();
      const difficultyBuffers = [];
      for(let i = 0; i < 100; i += 20) {
        const newBuffer = await sharp(temporaryBuffer)
          .extract({top: 0, height: options.diff.height, left: Math.floor(i * 0.01 * options.diff.width), width: Math.floor(0.2 * options.diff.width)})
          .extend(4)
          .toBuffer();
        difficultyBuffers.push(newBuffer);
      }

      image = sharp(file).removeAlpha();
      const scores = image.extract(options.acc).threshold(192).negate();
      temporaryBuffer = await scores.toBuffer();
      const accuracyBuffers = [];
      for(let i = 14; i < 100; i += 18.5) { // temporary hard-coded values for cuts
        const newBuffer = await sharp(temporaryBuffer)
          .extract({top: 0, height: options.acc.height, left: Math.floor(i * 0.01 * options.acc.width), width: Math.floor(7.5 * 0.01 * options.acc.width)})
          .extend(4)
          .toBuffer();
        accuracyBuffers.push(newBuffer);
      }

      return { 
        buffers: { nicknameBuffers, difficultyBuffers, accuracyBuffers }, 
        version: version
      };
    }

    async checkVersion(file: Buffer): Promise<"en" | "jp" | "jpcoop"> { // coop is only jp
      const image = sharp(file).removeAlpha();
      const { width } = await image.metadata();
      if(width === undefined)
        throw new Error();
      const values = image.extract({ top: 0, height: 1, left: Math.floor(width / 2), width: 1 });
      const rawValues = await values.raw().toBuffer();

      const r = rawValues.at(0);
      const g = rawValues.at(1);
      const b = rawValues.at(2);

      if(r === undefined || g === undefined || b === undefined)
        throw new Error();

      if(  withinRange(r, COLOURS.jp_coop.r[0], COLOURS.jp_coop.r[1])
        && withinRange(g, COLOURS.jp_coop.g[0], COLOURS.jp_coop.g[1])
        && withinRange(b, COLOURS.jp_coop.b[0], COLOURS.jp_coop.b[1]))
        return "jpcoop";

      if(  withinRange(r, COLOURS.jp.r[0], COLOURS.jp.r[1])
        && withinRange(g, COLOURS.jp.g[0], COLOURS.jp.g[1])
        && withinRange(b, COLOURS.jp.b[0], COLOURS.jp.b[1]))
        return "jp";

      if(  withinRange(r, COLOURS.en.r[0], COLOURS.en.r[1])
        && withinRange(g, COLOURS.en.g[0], COLOURS.en.g[1])
        && withinRange(b, COLOURS.en.b[0], COLOURS.en.b[1]))
        return "en";

      throw new Error();
    }
 
    private getOptions(version: "en" | "jp", width: number | undefined, height: number | undefined) {
        if(width === undefined || height === undefined)
            throw new Error("Invalid image");

        let song, acc;
      
        if(version === "en") { // en
          if((width / height) > 1.667) {// phone size
            song = { left: Math.floor(0.16 * width), top: 0, width: Math.floor(0.5 * width), height: Math.floor(0.06 * height) }
            acc = { left: Math.floor(0.45 * width), top: Math.floor(0.55 * height), width: Math.floor(0.08 * width), height: Math.floor(0.3 * height) }
          }
          else {// tablet size
            song =  { left: Math.floor(0.08 * width), top: 0, width: Math.floor(0.5 * width), height: Math.floor(0.05 * height) }
            acc =  { left: Math.floor(0.45 * width), top: Math.floor(0.55 * height), width: Math.floor(0.08 * width), height: Math.floor(0.22 * height) }
          }
        }
        else { // jp
          if((width / height) > 1.667) {// phone size
            song =  { left: Math.floor(0.25 * width), top: Math.floor(0.02 * height), width: Math.floor(0.25 * width), height: Math.floor(0.06 * height) }
            acc =  { left: Math.floor(0.28 * width), top: Math.floor(0.55 * height), width: Math.floor(0.08 * width), height: Math.floor(0.35 * height) }
          }
          else { // tablet size
            song =  { left: Math.floor(0.19 * width), top: Math.floor(0.02 * height), width: Math.floor(0.4 * width), height: Math.floor(0.05 * height) }
            acc =  { left: Math.floor(0.22 * width), top: Math.floor(0.55 * height), width: Math.floor(0.08 * width), height: Math.floor(0.3 * height) }
          }
        }
    
      
        return { song: song, acc: acc }
    }
      
    private getOptionsForCoop(version: "jpcoop",  width: number | undefined, height: number | undefined) {
      if(width === undefined || height === undefined)
        throw new Error("Invalid image");

      let name, diff, acc;
  
      if((width / height) > 1.667) {// phone size 
          name = { left: Math.floor(0.1 * width), top: Math.floor(0.42 * height),  width: Math.floor(0.8 * width),  height: Math.floor(0.05 * height) };
          diff = { left: Math.floor(0.1 * width), top: Math.floor(0.48 * height),  width: Math.floor(0.8 * width),  height: Math.floor(0.05 * height) };
          acc =  { left: Math.floor(0.1 * width), top: Math.floor(0.54 * height),  width: Math.floor(0.8 * width),  height: Math.floor(0.28 * height) };
      }
      else {
          name = { left: 0, top: Math.floor(0.45 * height), width: width,  height: Math.floor(0.04 * height) };
          diff = { left: 0, top: Math.floor(0.48 * height), width: width,  height: Math.floor(0.04 * height) };
          acc =  { left: 0, top: Math.floor(0.52 * height), width: width,  height: Math.floor(0.25 * height) };
      }
  
  
      return { name, diff, acc }
    } 
}