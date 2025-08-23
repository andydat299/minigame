import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import User from '../models/User.mjs';
import { formatCurrency } from './util.mjs';
export const data = new SlashCommandBuilder().setName('leaderboard').setDescription('Bảng xếp hạng')
  .addStringOption(o=>o.setName('type').setDescription('coins|earned|fish').addChoices({name:'coins',value:'coins'},{name:'earned',value:'earned'},{name:'fish',value:'fish'}));
export async function execute(interaction){
  const guildId = interaction.guildId; const type = interaction.options.getString('type') || 'coins';
  const sortKey = type==='earned' ? 'totalEarned' : (type==='fish' ? 'fishCaught' : 'coins');
  const top = await User.find({ guildId }).sort({ [sortKey]: -1 }).limit(10).lean();
  if (top.length===0){ await interaction.reply({ ephemeral:true, content:"Chưa có dữ liệu." }); return; }
  const lines = await Promise.all(top.map(async (u, idx)=>{
    let name = `<@${u.userId}>`; try { const member = await interaction.guild.members.fetch(u.userId); if (member) name = member.displayName; } catch {}
    const val = u[sortKey] || 0; return `**${idx+1}.** ${name}: ${formatCurrency(val)}${type==='coins'?'💰': type==='fish'?' 🐟':''}`;
  }));
  const eb = new EmbedBuilder().setColor(0xf59e0b).setTitle(`Top 10 (${type})`).setDescription(lines.join("\n"));
  await interaction.reply({ embeds:[eb] });
}
