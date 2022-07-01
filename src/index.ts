import { readConstants, ChartData, Difficulty, readLastModified } from './google/readConstants';
import { AutocompleteInteraction, CacheType, Client, Intents, MessageEmbed } from "discord.js";
import 'dotenv/config';

const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
let songData: ChartData[] | undefined = undefined;
let lastModifiedDate: number = 0;
let songNames: string[];

client.on('ready', async () => {
  songData = await readConstants();
  lastModifiedDate = await readLastModified();
  if(songData !== undefined)
    songNames = [...new Set(songData.map(chart => chart.name))];

  console.log(`Logged in as ${client?.user?.tag}!`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand() && !interaction.isAutocomplete()) return;
  if (songData === undefined) return;

  if(interaction.isAutocomplete()) {
    return autoCompleteName(interaction);
  }

  const { commandName, options } = interaction;

  await updateConstants();

  if (commandName === 'calculate_custom') {
    const constant = options.getNumber('constant');
    const score = options.getString('score');

    if(constant === null || score === null)
      interaction.reply("Invalid arguments");
    else {
      const data = calculateScore(constant, score, 0)
      if(data === undefined)
        interaction.reply("Invalid score data");
      else
        interaction.reply(stringResult(data?.result, constant, data?.diff, data?.accuracy, data?.scoreDataNum));
    }
  }

  if(commandName === 'calculate') {
    const song = options.getString('song');
    const difficulty = options.getString('difficulty');
    const score = options.getString('score');
    console.log(song, difficulty, score);

    const lookForSong = songData.find(data => song === data.name && difficulty === data.difficulty);
    if(lookForSong === undefined) 
      return await interaction.reply("Invalid arguments or chart wasn't found in database");

    const constant = lookForSong.constant;
    const noteCount = lookForSong.noteCount;

    if(constant === undefined || score === null)
      interaction.reply("Invalid arguments or chart wasn't found in database");
    else {
      const data = calculateScore(constant, score, noteCount);
      if(data === undefined)
        interaction.reply("Invalid score data");
      else {
        const embed = createEmbed(data?.result, constant, data?.diff, data?.accuracy, data?.scoreDataNum, song ?? "", difficulty ?? "");
        interaction.reply({ embeds: [embed] });
      }
        
    }
  }

  // ----
  if(commandName === 'calculate_manual') {
    const song = options.getString('song');
    const difficulty = options.getString('difficulty');
    const great = options.getInteger('great') ?? 0;
    const good = options.getInteger('good') ?? 0;
    const bad = options.getInteger('bad') ?? 0;
    const miss = options.getInteger('miss') ?? 0;
    console.log(song, difficulty, great, good, bad, miss);

    const lookForSong = songData.find(data => song === data.name && difficulty === data.difficulty);
    if(lookForSong === undefined) 
      return await interaction.reply("Invalid arguments or chart wasn't found in database");

    const constant = lookForSong.constant;
    const noteCount = lookForSong.noteCount;
      
    const data = calculateScoreWithNoteCount(constant, noteCount, great, good, bad, miss);
    if(data === undefined)
      interaction.reply("Invalid score data");
    else {
      const embed = createEmbed(data?.result, constant, data?.diff, data?.accuracy, data?.scoreDataNum, song ?? "", difficulty ?? "");
      interaction.reply({ embeds: [embed] });
    }
  }
});

client.login(process.env.TOKEN);

function calculateScore(constant: number, score: string, noteCount: number) {
  const scoreData = score.split('/');

  if(scoreData.length > 5 || scoreData.length < 1)
    return undefined;

  const scoreDataNum = generateScoreNum(scoreData, noteCount);
  if(scoreDataNum === undefined)
    return undefined;

  const accuracy = calcAccuracy(scoreDataNum);
  let constantModifier: number;

  if(accuracy > 1.00)
    return undefined;

  if(accuracy >= 0.99) {
    const diff = accuracy-0.99;
    constantModifier = diff * 200 + 2;
  }
  else if(accuracy < 0.99 && accuracy >= 0.97){
    const diff = accuracy-0.97;
    constantModifier = diff * 100;
  }
  else {
    const diff = accuracy-0.97;
    constantModifier = diff * 200 / 3;
  }

  const result = constant + constantModifier;
  const diff = ((constantModifier > 0) ? "+" : "") + `${constantModifier.toFixed(2)}`

  return { result, diff, accuracy, scoreDataNum };
}

function stringResult(result: number, constant: number, difference: string, accuracy: number, scoreDataNum: number[]) {
  return `Result: ${result.toFixed(2)} [${constant.toFixed(2)} ${difference}], accuracy: ${(accuracy * 100).toFixed(2)}%, score: ${scoreDataNum.join('/')}`;
}

function stringCustom(result: number, constant: number, difference: string, accuracy: number, scoreDataNum: number[], song: string, difficulty: string) {
  return `${song} [${difficulty}]
Result: *${result.toFixed(2)}* [${constant.toFixed(2)} ${difference}]
Accuracy: ${(accuracy * 100).toFixed(2)}%, Score: ${scoreDataNum.join('/')}`;
}

function createEmbed(result: number, constant: number, diff: string, accuracy: number, scoreDataNum: number[], song: string, difficulty: string){
  return new MessageEmbed()
    .setColor("#DDAACC")
    .setTitle(`${song} [${difficulty.toUpperCase()}]`)
    .addFields(
      { name: 'Result', value: `**${result.toFixed(2)}** [${constant.toFixed(2)} ${diff}] (*${calcRank(result)}*)` },
      { name: 'Accuracy', value: `${(accuracy * 100).toFixed(2)}%`, inline: true },
      { name: 'Score', value: `${scoreDataNum.join('/')}`, inline: true },
    );
}

function calcAccuracy(score: number[]) {
  const totalNoteAmount = score.reduce((acc, a) => acc + a, 0);
  
  const perf = score[0];
  const great = score[1];
  const good = score[2];
  const bad = score[3];
  const miss = score[4];

  const negative = great + good*2 + bad*3 + miss*3;
  const accuracy = (totalNoteAmount*3 - negative) / (totalNoteAmount*3);

  return accuracy;
}

async function autoCompleteName(interaction: AutocompleteInteraction<CacheType>) {
  const { commandName, options } = interaction;

  if(commandName === 'calculate' || commandName === 'calculate_manual') {
    const focusedValue = options.getFocused().toString().toLowerCase();
    const filtered = songNames?.filter(choice => choice.toLowerCase().includes(focusedValue));
    if(filtered !== undefined && filtered.length <= 25)
      await interaction.respond(
        filtered?.map(choice => ({ name: choice, value: choice }))
      )
  }
  
}


function calcRank(constant: number): string {
  if(constant >= 39)
    return "Space Gorilla";
  else if(constant >= 34)
    return "Gorilla";
  else if(constant >= 32)
    return "Diamond";
  else if(constant >= 30)
    return "Platinum";
  else if(constant >= 26)
    return "Gold";
  else if(constant >= 21)
    return "Silver";
  else if(constant >= 17.5)
    return "Bronze";
  else if(constant >= 0)
    return "Novice";
  else
    return "Troll";
}

function calculateScoreWithNoteCount(constant: number, noteCount: number, great: number, good: number, bad: number, miss: any) {
  const scoreDataNum = [
    noteCount - great - good - bad - miss,
    great, good, bad, miss
  ]

  const accuracy = calcAccuracy(scoreDataNum);
  let constantModifier: number;

  if(accuracy > 1.00)
    return undefined;

  if(accuracy >= 0.99) {
    const diff = accuracy-0.99;
    constantModifier = diff * 200 + 2;
  }
  else if(accuracy < 0.99 && accuracy >= 0.97){
    const diff = accuracy-0.97;
    constantModifier = diff * 100;
  }
  else {
    const diff = accuracy-0.97;
    constantModifier = diff * 200 / 3;
  }

  const result = constant + constantModifier;
  const diff = ((constantModifier > 0) ? "+" : "") + `${constantModifier.toFixed(2)}`

  return { result, diff, accuracy, scoreDataNum };
}
function generateScoreNum(score: string[], noteCount: number) {
  if(score.length === 5) {
    return score.map(s => parseInt(s));
  }

  if(score.length > 0) {
    const arr = score.map(s => parseInt(s));
    const great = arr[0];
    const good = arr[1] ?? 0;
    const bad = arr[2] ?? 0;
    const miss = arr[3] ?? 0;

    return [
      noteCount - great - good - bad - miss,
      great, good, bad, miss
    ]
  }

  return undefined;
}

async function updateConstants() {
  const THIRTY_MINUTES = 1000 * 60 * 30;
  const current = Date.now();

  if(lastModifiedDate + THIRTY_MINUTES > current)
    return;

  const newDate = await readLastModified();
  if(lastModifiedDate === newDate)
    return;

  lastModifiedDate = newDate;
  songData = await readConstants();
}