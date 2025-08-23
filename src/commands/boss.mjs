import { SlashCommandBuilder } from 'discord.js';
import GuildConfig from '../models/GuildConfig.mjs';
import { infoEmbed, successEmbed, errorEmbed, vnNow } from './util.mjs';
import { isDev } from '../config.mjs';
function parseHours(str){ if(!str) return []; return str.split(',').map(s=>s.trim()).filter(Boolean).map(x=>parseInt(x,10)).filter(x=>x>=0&&x<=23); }
export const data = new SlashCommandBuilder().setName('boss').setDescription('Sự kiện Boss (giờ VN hoặc tay)')
  .addSubcommand(sc=>sc.setName('status').setDescription('Xem trạng thái'))
  .addSubcommand(sc=>sc.setName('set').setDescription('Thiết lập lịch Boss')
    .addStringOption(o=>o.setName('hours').setDescription('Giờ VN, ví dụ: 12,20').setRequired(true))
    .addIntegerOption(o=>o.setName('duration').setDescription('Phút (mặc định 15)'))
    .addIntegerOption(o=>o.setName('dropvalue').setDescription('Giá Boss Drop (mặc định 600)')))
  .addSubcommand(sc=>sc.setName('start').setDescription('Kích hoạt Boss tay').addIntegerOption(o=>o.setName('minutes').setDescription('Phút').setRequired(true)))
  .addSubcommand(sc=>sc.setName('defaults').setDescription('Đặt lịch mặc định: 12h & 20h, 15 phút, 600💰'));
export async function execute(interaction){
  const sub = interaction.options.getSubcommand(); const guildId = interaction.guildId;
  let cfg = await GuildConfig.findOne({ guildId }); if (!cfg) cfg = await GuildConfig.create({ guildId });
  if (sub==='status'){ const nowVN = vnNow(); const active = cfg.bossActiveUntil && cfg.bossActiveUntil > new Date(); const hours = (cfg.bossHours||[]).sort((a,b)=>a-b).join(', ') || 'chưa đặt'; const untilStr = active ? `<t:${Math.floor(cfg.bossActiveUntil.getTime()/1000)}:R>` : 'không'; await interaction.reply({ embeds:[infoEmbed('Boss Status', `Giờ VN hiện tại: ${nowVN.toISOString().slice(11,16)}\nGiờ mở: **${hours}**\nThời lượng: **${cfg.bossDurationMin} phút**\nBoss Drop: **${cfg.bossDropValue}💰**\nĐang hoạt động: **${active?'Có':'Không'}** (kết thúc: ${untilStr})`)] }); return; }
  if (sub==='set'){ if (!isDev(interaction.user.id) && !interaction.memberPermissions.has('Administrator')){ await interaction.reply({ ephemeral:true, embeds:[errorEmbed('Chỉ Admin hoặc Dev được phép thiết lập.')] }); return; } const hours = parseHours(interaction.options.getString('hours', true)); if (hours.length===0){ await interaction.reply({ ephemeral:true, embeds:[errorEmbed('Danh sách giờ không hợp lệ.')] }); return; } const dur = interaction.options.getInteger('duration') ?? 15; const val = interaction.options.getInteger('dropvalue') ?? 600; cfg.bossHours = hours; cfg.bossDurationMin = Math.max(5, Math.min(120, dur)); cfg.bossDropValue = Math.max(100, Math.min(5000, val)); await cfg.save(); await interaction.reply({ embeds:[successEmbed(`Đã đặt Boss: giờ VN **${hours.join(', ')}**, thời lượng **${cfg.bossDurationMin} phút**, drop **${cfg.bossDropValue}💰**`)] }); return; }
  if (sub==='start'){ if (!isDev(interaction.user.id) && !interaction.memberPermissions.has('Administrator')){ await interaction.reply({ ephemeral:true, embeds:[errorEmbed('Chỉ Admin hoặc Dev được phép khởi động.')] }); return; } const minutes = interaction.options.getInteger('minutes', true); const now = new Date(); cfg.bossActiveUntil = new Date(now.getTime() + minutes*60*1000); await cfg.save(); await interaction.reply({ embeds:[successEmbed(`Đã kích hoạt Boss trong **${minutes} phút**.`)] }); return; }
  if (sub==='defaults'){ if (!isDev(interaction.user.id) && !interaction.memberPermissions.has('Administrator')){ await interaction.reply({ ephemeral:true, embeds:[errorEmbed('Chỉ Admin hoặc Dev được phép thiết lập.')] }); return; } cfg.bossHours = [12,20]; cfg.bossDurationMin = 15; cfg.bossDropValue = 600; await cfg.save(); await interaction.reply({ embeds:[successEmbed('Đã đặt lịch mặc định: giờ VN 12h, 20h • 15 phút • Boss Drop 600💰')] }); return; }
}
