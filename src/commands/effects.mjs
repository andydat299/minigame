import { SlashCommandBuilder } from 'discord.js';
import User from '../models/User.mjs';
import { EFFECTS, getActive, now, formatRemaining } from '../game/effects.mjs';
import { infoEmbed } from './util.mjs';
export const data = new SlashCommandBuilder().setName('effects').setDescription('Xem buff và vật phẩm');
function listItems(map){ if (!map || map.size===0) return "Không có vật phẩm."; const out=[]; for (const [k,v] of map.entries()) out.push(`${k}: ${v}`); return out.join(' | '); }
export async function execute(interaction){
  const userId = interaction.user.id, guildId = interaction.guildId; let profile = await User.findOne({ userId, guildId }); if (!profile) profile = await User.create({ userId, guildId });
  const act = getActive(profile); const t = now();
  const lines = act.length ? act.map(e=>{ const label = EFFECTS[e.key]?.label || e.key; const rem = e.until?formatRemaining(e.until - t):'...'; return `• ${label}: còn ${rem}`; }) : ["Không có buff nào đang chạy."];
  lines.push(`\nVật phẩm: ${listItems(profile.items)}`); lines.push(`Bait: ${profile.bait||0}🪱`);
  await interaction.reply({ embeds:[infoEmbed("Buff hiện tại", lines.join('\n'))] });
}
