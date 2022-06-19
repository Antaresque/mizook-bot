import { SlashCommandBuilder } from "@discordjs/builders";
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';

import 'dotenv/config';
import { readConstants } from "./google/readConstants";

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN!);

(async () => {
  try {
    
    const songData = await readConstants(); 
    if(songData === undefined)
      throw new Error("??? no sheet");

    const songDiff = ["Hard", "Expert", "Master"];

    const chartDifficulties = songDiff.map(diff => ({name: diff, value: diff}));

    const calc =  new SlashCommandBuilder().setName('calculate_custom').setDescription('does something idk')
    .addNumberOption(option =>
      option.setName('constant')
        .setDescription('Song constant')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('score')
        .setDescription('Your score in P/G/G/B/M format - for example: 920/2/0/0/1')
        .setRequired(true));

    const enumCalc = new SlashCommandBuilder().setName('calculate').setDescription('Calculate score for chosen chart')
      .addStringOption(option => 
        option.setName('song')
        .setDescription('Song name')
        .setRequired(true)
        .setAutocomplete(true))
      .addStringOption(option => 
        option.setName('difficulty')
        .setDescription('Chart difficulty')
        .setRequired(true)
        .setChoices(...chartDifficulties))
      .addStringOption(option =>
        option.setName('score')
        .setDescription('Your score in P/G/G/B/M format - for example: 920/2/0/0/1')
        .setRequired(true));

    const commands = [calc, enumCalc].map(command => command.toJSON());

    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(process.env.ID!),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();