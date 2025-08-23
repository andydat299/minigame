import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import User from '../models/User.mjs';
import { formatCurrency } from './util.mjs';
import { getMaxDurability } from '../game/durability.mjs';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('Xem thông tin profile của bạn hoặc người khác')
  .addUserOption(option => option.setName('user').setDescription('Người dùng muốn xem profile').setRequired(false));

export async function execute(interaction) {
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const userId = targetUser.id;
  const guildId = interaction.guildId;
  
  let profile = await User.findOne({ userId, guildId });
  if (!profile) profile = await User.create({ userId, guildId });

  const embed = new EmbedBuilder()
    .setColor('#48dbfb')
    .setTitle(`👤 Profile - ${targetUser.username}`)
    .setThumbnail(targetUser.displayAvatarURL())
    .setTimestamp();

  // Add durability info to profile display
  const rodDurability = profile.rodDurability || 0;
  const maxDurability = getMaxDurability(profile.rodLevel);
  const durabilityPercent = Math.round((rodDurability / maxDurability) * 100);

  // Determine durability status
  let durabilityStatus = '';
  let durabilityEmoji = '';
  if (durabilityPercent >= 90) {
      durabilityStatus = 'Như mới';
      durabilityEmoji = '✨';
  } else if (durabilityPercent >= 70) {
      durabilityStatus = 'Tốt';
      durabilityEmoji = '✅';
  } else if (durabilityPercent >= 50) {
      durabilityStatus = 'Khá';
      durabilityEmoji = '🟡';
  } else if (durabilityPercent >= 30) {
      durabilityStatus = 'Trung bình';
      durabilityEmoji = '🟠';
  } else if (durabilityPercent >= 10) {
      durabilityStatus = 'Kém';
      durabilityEmoji = '🔴';
  } else {
      durabilityStatus = 'Hỏng';
      durabilityEmoji = '💥';
  }

  embed.addFields(
    {name:"💰 Coins", value:formatCurrency(profile.coins||0), inline:true},
    {name:"🎣 Cần câu", value:`Level ${profile.rodLevel||1}`, inline:true},
    {name:"🐟 Cá đã câu", value:`${profile.fishCaught||0} con`, inline:true},
    {name:"🪣 Mồi", value:`${profile.bait||0}`, inline:true},
    {name:"💎 Đã kiếm", value:formatCurrency(profile.totalEarned||0), inline:true},
    { name: '🔧 Độ Bền Cần Câu', value: `${rodDurability}/${maxDurability} (${durabilityPercent}%)\n${durabilityEmoji} ${durabilityStatus}`, inline: true }
  );

  await interaction.reply({ embeds: [embed] });
}
