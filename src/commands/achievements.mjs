import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import User from '../models/User.mjs';
import { formatCurrency, errorEmbed } from './util.mjs';

export const data = new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('Xem thành tựu của bạn')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('Xem thành tựu của người khác')
            .setRequired(false));

// Achievement definitions
export const ACHIEVEMENTS = {
    // Fishing achievements
    'first_fish': {
        name: '🎣 Người Mới Bắt Đầu',
        description: 'Câu được cá đầu tiên',
        condition: (profile) => (profile.fishCaught || 0) >= 1,
        reward: { coins: 500 },
        rarity: 'common'
    },
    'fish_100': {
        name: '🐟 Thợ Câu',
        description: 'Câu được 100 con cá',
        condition: (profile) => (profile.fishCaught || 0) >= 100,
        reward: { coins: 5000 },
        rarity: 'uncommon'
    },
    'fish_500': {
        name: '🎯 Bậc Thầy Câu Cá',
        description: 'Câu được 500 con cá',
        condition: (profile) => (profile.fishCaught || 0) >= 500,
        reward: { coins: 15000, item: 'Cần câu vàng' },
        rarity: 'rare'
    },
    'fish_1000': {
        name: '👑 Vua Câu Cá',
        description: 'Câu được 1000 con cá',
        condition: (profile) => (profile.fishCaught || 0) >= 1000,
        reward: { coins: 50000, item: 'Vương miện câu cá' },
        rarity: 'legendary'
    },

    // Money achievements
    'first_1000': {
        name: '💰 Tiền Đầu Tiên',
        description: 'Có 1,000 coins',
        condition: (profile) => (profile.coins || 0) >= 1000,
        reward: { coins: 200 },
        rarity: 'common'
    },
    'rich_100k': {
        name: '💎 Giàu Có',
        description: 'Có 100,000 coins',
        condition: (profile) => (profile.coins || 0) >= 100000,
        reward: { coins: 10000 },
        rarity: 'rare'
    },
    'millionaire': {
        name: '🏆 Triệu Phú',
        description: 'Có 1,000,000 coins',
        condition: (profile) => (profile.coins || 0) >= 1000000,
        reward: { coins: 100000, item: 'Huy chương vàng' },
        rarity: 'legendary'
    },

    // Daily achievements
    'daily_streak_7': {
        name: '📅 Kiên Trì',
        description: 'Nhận daily 7 ngày liên tiếp',
        condition: (profile) => (profile.dailyStreak || 0) >= 7,
        reward: { coins: 5000 },
        rarity: 'uncommon'
    },
    'daily_total_30': {
        name: '🗓️ Người Trung Thành',
        description: 'Nhận daily tổng cộng 30 lần',
        condition: (profile) => (profile.totalDailyClaimed || 0) >= 30,
        reward: { coins: 15000 },
        rarity: 'rare'
    },

    // Gambling achievements
    'lucky_win': {
        name: '🍀 May Mắn',
        description: 'Thắng 10,000 coins từ casino',
        condition: (profile) => (profile.totalWon || 0) >= 10000,
        reward: { coins: 2000 },
        rarity: 'uncommon'
    },
    'big_gambler': {
        name: '🎰 Tay Chơi Lớn',
        description: 'Cược tổng cộng 100,000 coins',
        condition: (profile) => (profile.totalGambled || 0) >= 100000,
        reward: { coins: 10000 },
        rarity: 'rare'
    },

    // Rod achievements
    'upgrade_master': {
        name: '🔧 Thợ Máy',
        description: 'Nâng cấp cần câu lên level 5',
        condition: (profile) => (profile.rodLevel || 1) >= 5,
        reward: { coins: 8000 },
        rarity: 'uncommon'
    },
    'max_rod': {
        name: '⚡ Siêu Cần Câu',
        description: 'Nâng cấp cần câu lên level tối đa',
        condition: (profile) => (profile.rodLevel || 1) >= 10,
        reward: { coins: 25000, item: 'Cần câu huyền thoại' },
        rarity: 'legendary'
    }
};

export async function execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const userId = targetUser.id;
    const guildId = interaction.guildId;
    
    let profile = await User.findOne({ userId, guildId });
    if (!profile) profile = await User.create({ userId, guildId });

    // Check and update achievements
    const newAchievements = [];
    const userAchievements = profile.achievements || [];

    for (const [key, achievement] of Object.entries(ACHIEVEMENTS)) {
        if (!userAchievements.includes(key) && achievement.condition(profile)) {
            userAchievements.push(key);
            newAchievements.push({ key, ...achievement });
        }
    }

    // Save new achievements and give rewards
    if (newAchievements.length > 0) {
        profile.achievements = userAchievements;
        
        let totalCoinReward = 0;
        const itemRewards = [];
        
        for (const achievement of newAchievements) {
            if (achievement.reward.coins) {
                totalCoinReward += achievement.reward.coins;
            }
            if (achievement.reward.item) {
                itemRewards.push(achievement.reward.item);
                const item = profile.inventory.find(i => i.name === achievement.reward.item);
                if (item) item.count += 1;
                else profile.inventory.push({ name: achievement.reward.item, count: 1 });
            }
        }
        
        profile.coins = (profile.coins || 0) + totalCoinReward;
        await profile.save();
    }

    // Create achievements display
    const achievedCount = userAchievements.length;
    const totalCount = Object.keys(ACHIEVEMENTS).length;
    const progressPercent = Math.round((achievedCount / totalCount) * 100);

    const embed = new EmbedBuilder()
        .setColor('#ffd700')
        .setTitle(`🏆 Thành Tựu - ${targetUser.username}`)
        .setDescription(`**${achievedCount}/${totalCount}** thành tựu (${progressPercent}%)`)
        .setTimestamp();

    // Group achievements by rarity
    const achievementsByRarity = {
        legendary: [],
        rare: [],
        uncommon: [],
        common: []
    };

    for (const [key, achievement] of Object.entries(ACHIEVEMENTS)) {
        const isAchieved = userAchievements.includes(key);
        const display = isAchieved ? `✅ ${achievement.name}` : `❌ ${achievement.name}`;
        achievementsByRarity[achievement.rarity].push(display);
    }

    // Add fields for each rarity
    const rarityColors = {
        legendary: '🌟 **Huyền Thoại**',
        rare: '💎 **Hiếm**',
        uncommon: '🟦 **Không Phổ Biến**',
        common: '⚪ **Phổ Biến**'
    };

    for (const [rarity, achievements] of Object.entries(achievementsByRarity)) {
        if (achievements.length > 0) {
            embed.addFields({
                name: rarityColors[rarity],
                value: achievements.join('\n'),
                inline: false
            });
        }
    }

    // Show new achievements if any
    if (newAchievements.length > 0 && targetUser.id === interaction.user.id) {
        const newAchievementText = newAchievements.map(a => `🎉 ${a.name}`).join('\n');
        embed.addFields({
            name: '🆕 Thành Tựu Mới!',
            value: newAchievementText,
            inline: false
        });
    }

    await interaction.reply({ embeds: [embed] });
}

// Function to check achievements (to be called from other commands)
export async function checkAchievements(profile) {
    const userAchievements = profile.achievements || [];
    const newAchievements = [];

    for (const [key, achievement] of Object.entries(ACHIEVEMENTS)) {
        if (!userAchievements.includes(key) && achievement.condition(profile)) {
            userAchievements.push(key);
            newAchievements.push({ key, ...achievement });
        }
    }

    if (newAchievements.length > 0) {
        profile.achievements = userAchievements;
        
        let totalCoinReward = 0;
        for (const achievement of newAchievements) {
            if (achievement.reward.coins) {
                totalCoinReward += achievement.reward.coins;
            }
            if (achievement.reward.item) {
                const item = profile.inventory.find(i => i.name === achievement.reward.item);
                if (item) item.count += 1;
                else profile.inventory.push({ name: achievement.reward.item, count: 1 });
            }
        }
        
        profile.coins = (profile.coins || 0) + totalCoinReward;
    }

    return newAchievements;
}