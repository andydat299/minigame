import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import User from '../models/User.mjs';
import { formatCurrency } from './util.mjs';
import { upgradeCost } from '../game/fishData.mjs';
import { errorEmbed, successEmbed } from './util.mjs';
export const data = new SlashCommandBuilder().setName('upgrade').setDescription('Nâng cấp cần câu');
export async function execute(interaction){
  const userId = interaction.user.id, guildId = interaction.guildId;
  let profile = await User.findOne({ userId, guildId }); if (!profile) profile = await User.create({ userId, guildId });
  if (profile.rodLevel>=10){ await interaction.reply({ ephemeral:true, embeds:[errorEmbed("Cần câu đã cấp tối đa (10).")] }); return; }
  const cost = upgradeCost(profile.rodLevel);
  if (profile.coins < cost){ await interaction.reply({ ephemeral:true, embeds:[errorEmbed(`Cần ${formatCurrency(cost)}💰 để nâng cấp. Bạn còn thiếu ${formatCurrency(cost-profile.coins)}💰.`)] }); return; }
  profile.coins -= cost; profile.rodLevel += 1; await profile.save();
  await interaction.reply({ embeds:[successEmbed(`Nâng cấp thành công! Cần câu hiện tại: **cấp ${profile.rodLevel}** (trừ ${formatCurrency(cost)}💰).`)] });
}
