import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import User from '../models/User.mjs';
import { formatCurrency } from './util.mjs';
import { applyEventBonus, currentEvent } from './fishingevent.mjs';
import { updateQuestProgress } from '../game/questManager.mjs';

// Fish values mapping (simplified to avoid import issues)
const FISH_VALUES = {
  'Cá Hồi': 150,
  'Cá Ngừ': 200,
  'Cá Mập': 500,
  'Cá Vàng': 100,
  'Cá Bơn': 120,
  'Cá Thu': 180,
  'Cá Rô': 80,
  'Cá Trê': 90,
  'Cá Chép': 70,
  'Cá Diêu Hồng': 300,
  'Cá Kiếm': 400,
  'Cá Heo': 600,
  'Cá Voi': 1000,
  'Rùa Biển': 800,
  'Bạch Tuộc': 350,
  'Tôm Hùm': 250,
  'Cua Hoàng Gia': 450,
  'Sò Điệp': 60,
  'Vảy rồng': 2000
};

export const data = new SlashCommandBuilder()
  .setName('sellall')
  .setDescription('Bán tất cả cá trong kho');

export async function execute(interaction) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  let profile = await User.findOne({ userId, guildId });
  if (!profile) profile = await User.create({ userId, guildId });

  if (!profile.inventory || profile.inventory.length === 0) {
    await interaction.reply({ ephemeral: true, content: 'Bạn không có cá nào để bán!' });
    return;
  }

  let totalValue = 0;
  let totalFishSold = 0;
  let eventBonusApplied = false;
  const soldItems = [];
  
  for (const item of profile.inventory) {
    if (item.count > 0) {
      // Get fish value from our mapping, default to 100 if not found
      const baseValue = FISH_VALUES[item.name] || 100;
      const eventResult = applyEventBonus(interaction.user.id, baseValue, item.name);
      const fishValue = eventResult.value || baseValue;
      
      if (eventResult.isEventCatch) {
        eventBonusApplied = true;
      }
      
      const itemTotal = fishValue * item.count;
      totalValue += itemTotal;
      totalFishSold += item.count;
      
      soldItems.push(`${item.name} x${item.count} = ${formatCurrency(itemTotal)}`);
      item.count = 0;
    }
  }

  profile.inventory = profile.inventory.filter(item => item.count > 0);

  if (totalValue === 0) {
    await interaction.reply({ ephemeral: true, content: 'Bạn không có cá nào để bán!' });
    return;
  }

  profile.coins = (profile.coins || 0) + totalValue;
  profile.totalEarned = (profile.totalEarned || 0) + totalValue;
  await profile.save();

  await updateQuestProgress(interaction.user.id, interaction.guildId, 'coinsEarn', totalValue);

  const embed = new EmbedBuilder()
    .setColor('#00ff00')
    .setTitle('💰 Đã Bán Tất Cả Cá!')
    .addFields(
      { name: '🐟 Tổng Cá Bán', value: `${totalFishSold} con`, inline: true },
      { name: '💰 Tổng Thu Nhập', value: formatCurrency(totalValue), inline: true },
      { name: '🪙 Số Dư Hiện Tại', value: formatCurrency(profile.coins), inline: true }
    );

  if (eventBonusApplied && currentEvent) {
    embed.addFields({ 
      name: '🎉 Event Bonus', 
      value: `${currentEvent.name} bonus đã được áp dụng cho giá bán!`, 
      inline: false 
    });
  }

  if (soldItems.length <= 10) {
    embed.addFields({ name: '📦 Chi Tiết', value: soldItems.join('\n'), inline: false });
  }

  embed.setTimestamp();
  await interaction.reply({ embeds: [embed] });
}
