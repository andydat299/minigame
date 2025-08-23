import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import User from '../models/User.mjs';
import { formatCurrency, successEmbed } from './util.mjs';
import { updateQuestProgress } from '../game/questManager.mjs';

export const data = new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Nhận phần thưởng hàng ngày');

// Daily reward configuration
const DAILY_REWARDS = {
    base: 1000,
    streak_bonus: 500,
    max_streak: 7,
    special_rewards: {
        3: { item: 'Mồi câu', amount: 5 },
        7: { item: 'Rương bí ẩn', amount: 1 }
    }
};

export async function execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    let profile = await User.findOne({ userId, guildId });
    if (!profile) profile = await User.create({ userId, guildId });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastDaily = profile.lastDaily ? new Date(profile.lastDaily) : null;
    const lastDailyDate = lastDaily ? new Date(lastDaily.getFullYear(), lastDaily.getMonth(), lastDaily.getDate()) : null;

    // Check if already claimed today
    if (lastDailyDate && lastDailyDate.getTime() === today.getTime()) {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const timeUntilReset = Math.ceil((tomorrow - now) / (1000 * 60 * 60));
        
        const embed = new EmbedBuilder()
            .setColor('#feca57')
            .setTitle('🎁 Đã Nhận Hôm Nay')
            .setDescription(`Bạn đã nhận phần thưởng hàng ngày rồi!\n\nQuay lại sau **${timeUntilReset} giờ** để nhận tiếp.`)
            .addFields(
                { name: '📅 Streak Hiện Tại', value: `${profile.dailyStreak || 0} ngày`, inline: true },
                { name: '⏰ Reset Vào', value: `<t:${Math.floor(tomorrow.getTime() / 1000)}:R>`, inline: true }
            )
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Calculate streak
    let newStreak = 1;
    if (lastDailyDate) {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (lastDailyDate.getTime() === yesterday.getTime()) {
            newStreak = Math.min((profile.dailyStreak || 0) + 1, DAILY_REWARDS.max_streak);
        }
    }

    // Calculate rewards
    const baseReward = DAILY_REWARDS.base;
    const streakBonus = (newStreak - 1) * DAILY_REWARDS.streak_bonus;
    const totalCoins = baseReward + streakBonus;

    // Update profile
    profile.coins = (profile.coins || 0) + totalCoins;
    profile.lastDaily = now;
    profile.dailyStreak = newStreak;
    profile.totalDailyClaimed = (profile.totalDailyClaimed || 0) + 1;

    // Special rewards
    let specialReward = null;
    if (DAILY_REWARDS.special_rewards[newStreak]) {
        const reward = DAILY_REWARDS.special_rewards[newStreak];
        specialReward = reward;
        
        if (reward.item === 'Mồi câu') {
            profile.bait = (profile.bait || 0) + reward.amount;
        } else if (reward.item === 'Rương bí ẩn') {
            const item = profile.inventory.find(i => i.name === reward.item);
            if (item) item.count += reward.amount;
            else profile.inventory.push({ name: reward.item, count: reward.amount });
        }
    }

    await profile.save();

    // Update quest progress
    await updateQuestProgress(interaction.user.id, interaction.guildId, 'dailyStreak', newStreak);

    // Create reward embed
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🎁 Phần Thưởng Hàng Ngày')
        .setDescription(`Chúc mừng! Bạn đã nhận được phần thưởng ngày ${profile.totalDailyClaimed}!`)
        .addFields(
            { name: '💰 Phần Thưởng Cơ Bản', value: formatCurrency(baseReward), inline: true },
            { name: '🔥 Bonus Streak', value: formatCurrency(streakBonus), inline: true },
            { name: '💵 Tổng Nhận', value: formatCurrency(totalCoins), inline: true },
            { name: '📅 Streak', value: `${newStreak}/${DAILY_REWARDS.max_streak} ngày`, inline: true },
            { name: '🪙 Tổng Coins', value: formatCurrency(profile.coins), inline: true }
        )
        .setTimestamp();

    if (specialReward) {
        embed.addFields({ 
            name: '🎉 Phần Thưởng Đặc Biệt!', 
            value: `**${specialReward.item}** x${specialReward.amount}`, 
            inline: false 
        });
    }

    // Add next day preview
    const nextStreak = Math.min(newStreak + 1, DAILY_REWARDS.max_streak);
    const nextReward = DAILY_REWARDS.base + (nextStreak - 1) * DAILY_REWARDS.streak_bonus;
    let nextSpecial = '';
    if (DAILY_REWARDS.special_rewards[nextStreak]) {
        const reward = DAILY_REWARDS.special_rewards[nextStreak];
        nextSpecial = ` + **${reward.item}** x${reward.amount}`;
    }
    
    embed.addFields({ 
        name: '👀 Ngày Mai', 
        value: `${formatCurrency(nextReward)}${nextSpecial}`, 
        inline: false 
    });

    await interaction.reply({ embeds: [embed] });
}