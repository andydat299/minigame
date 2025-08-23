import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import User from '../models/User.mjs';
import { formatCurrency } from './util.mjs';
import { errorEmbed, successEmbed } from './util.mjs';
export const data = new SlashCommandBuilder().setName('give').setDescription('Chuyển coin trong server')
  .addUserOption(o=>o.setName('user').setDescription('Người nhận').setRequired(true))
  .addIntegerOption(o=>o.setName('amount').setDescription('Số coin').setRequired(true));
export async function execute(interaction){
  const fromId = interaction.user.id;
  const toUser = interaction.options.getUser('user', true);
  const amount = interaction.options.getInteger('amount', true);
  if (amount<=0){ await interaction.reply({ ephemeral:true, embeds:[errorEmbed('Số tiền phải > 0')] }); return; }
  if (toUser.id===fromId){ await interaction.reply({ ephemeral:true, embeds:[errorEmbed('Không thể tự chuyển cho chính mình.')] }); return; }
  const guildId = interaction.guildId;
  let from = await User.findOne({ userId: fromId, guildId }); if (!from) from = await User.create({ userId: fromId, guildId });
  if (from.coins < amount){ await interaction.reply({ ephemeral:true, embeds:[errorEmbed('Bạn không đủ coin.')] }); return; }
  let to = await User.findOne({ userId: toUser.id, guildId }); if (!to) to = await User.create({ userId: toUser.id, guildId });
  const fee = Math.max(1, Math.floor(amount*0.02)); const net = amount - fee;
  from.coins -= amount; to.coins += net;
  await from.save(); await to.save();
  await interaction.reply({ embeds:[successEmbed(`Đã chuyển **${formatCurrency(amount)}** (phí ${formatCurrency(fee)}) cho ${toUser}. Bạn còn: **${formatCurrency(from.coins)}**`)] });
}
