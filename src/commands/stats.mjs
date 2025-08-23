import { SlashCommandBuilder } from 'discord.js';
import { rarityWeightsForRod, RARITIES } from '../game/fishData.mjs';
import { infoEmbed } from './util.mjs';
export const data = new SlashCommandBuilder().setName('stats').setDescription('Tỉ lệ rơi theo cấp cần');
function fmt(n){ return (Math.round(n*10)/10).toFixed(1); }
export async function execute(interaction){
  const lines=[];
  for (let lvl=1; lvl<=10; lvl++){ const w=rarityWeightsForRod(lvl); const tot=Object.values(w).reduce((a,b)=>a+b,0); const parts=RARITIES.map(r=>`${r}: ${fmt((w[r]/tot)*100)}%`).join(' | '); lines.push(`Cấp ${lvl}: ${parts}`); }
  await interaction.reply({ embeds:[infoEmbed('Tỉ lệ rơi (ước tính)', lines.join('\n'))] });
}
