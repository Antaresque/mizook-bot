import { Service } from "@antaresque/dissonance";
import sharp from 'sharp';

const COLOURS = {
  jp: {r: [175,25], g: [175,25], b: [200,40]},
  en: {r: [75,25], g: [75,25], b: [100,40]}
}

const withinRange = (value: number, target: number, range: number) => {
  return value >= target - range && value <= target + range;
}

@Service()
export class TesseractImageService {

    public async cutBuffer(file: Buffer) {
        let image = sharp(file).removeAlpha();
        const { width, height } = await image.metadata();
        const version = await this.checkVersion(file);
        const options = this.getOptions(version, width, height);
        
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

    async checkVersion(file: Buffer): Promise<"en" | "jp"> {
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
      
    private getOptionsForCoop(isEN: boolean, width: number, height: number) {
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