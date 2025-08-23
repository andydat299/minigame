import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import User from '../models/User.mjs';
import { formatCurrency } from './util.mjs';
import { isDev } from '../config.mjs';
import { errorEmbed, successEmbed } from './util.mjs';
export const data = new SlashCommandBuilder().setName('addcash').setDescription('Dev-only: cộng coin')
  .addUserOption(o=>o.setName('user').setDescription('Người nhận').setRequired(true))
  .addIntegerOption(o=>o.setName('amount').setDescription('Số coin').setRequired(true));
export async function execute(interaction){
  const caller = interaction.user.id; if (!isDev(caller)){ await interaction.reply({ ephemeral:true, embeds:[errorEmbed("Bạn không có quyền dùng lệnh này.")] }); return; }
  const target = interaction.options.getUser('user', true); const amount = interaction.options.getInteger('amount', true);
  if (!Number.isFinite(amount) || amount===0){ await interaction.reply({ ephemeral:true, embeds:[errorEmbed("Số tiền không hợp lệ.")] }); return; }
  const guildId = interaction.guildId;
  let profile = await User.findOne({ userId: target.id, guildId }); if (!profile) profile = await User.create({ userId: target.id, guildId });
  profile.coins += amount; await profile.save();
  await interaction.reply({ embeds:[successEmbed(`Đã cộng **${formatCurrency(amount)}💰** cho ${target}. Số dư mới: **${formatCurrency(profile.coins)}💰**`)] });
}
