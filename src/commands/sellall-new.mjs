import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import User from '../models/User.mjs';
import { fishData } from '../game/fishData.mjs';
import { formatCurrency } from './util.mjs';
import { applyEventBonus, currentEvent } from './fishingevent.mjs';
import { updateQuestProgress } from '../game/questManager.mjs';

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
    const fishItem = fishData.find(f => f.name === item.name);
    if (fishItem && item.count > 0) {
      const baseValue = fishItem.value || 100;
      const eventResult = applyEventBonus(interaction.user.id, baseValue, fishItem.name);
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