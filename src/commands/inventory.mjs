import { SlashCommandBuilder } from 'discord.js';
import User from '../models/User.mjs';
import { FISH } from '../game/fishData.mjs';
import { infoEmbed } from './util.mjs';
export const data = new SlashCommandBuilder().setName('inventory').setDescription('Xem kho cá');
export async function execute(interaction){
  const userId = interaction.user.id, guildId = interaction.guildId;
  let profile = await User.findOne({ userId, guildId });
  if (!profile || profile.inventory.length===0){ await interaction.reply({ ephemeral:true, content:"Kho cá đang trống." }); return; }
  const priceMap = new Map(FISH.map(f=>[f.name,f.price]));
  let total=0, lines=[];
  for (const it of profile.inventory){ const p=priceMap.get(it.name)||0; total += p*it.count; lines.push(`• ${it.name}: x${it.count} × ${p} = ${p*it.count}💰`); }
  lines.push(`\nTổng giá trị: **${total}💰**`);
  await interaction.reply({ embeds:[infoEmbed("Kho cá", lines.join('\n'))] });
}
