const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const Database = require('../database/database');

// Quests định nghĩa
const dailyQuests = [
    {
        id: 'play_5_games',
        name: 'Gamer Active',
        description: 'Chơi 5 games bất kỳ',
        emoji: '🎮',
        target: 5,
        reward: { coins: 200, xp: 30 },
        type: 'play_games'
    },
    {
        id: 'earn_1000_coins',
        name: 'Money Maker',
        description: 'Kiếm 1000 coins từ games',
        emoji: '💰',
        target: 1000,
        reward: { coins: 300, xp: 40 },
        type: 'earn_coins'
    },
    {
        id: 'mining_10_times',
        name: 'Miner',
        description: 'Đào 10 lần',
        emoji: '⛏️',
        target: 10,
        reward: { coins: 250, xp: 35 },
        type: 'mining'
    },
    {
        id: 'win_3_battles',
        name: 'Warrior',
        description: 'Thắng 3 trận chiến',
        emoji: '⚔️',
        target: 3,
        reward: { coins: 400, xp: 50 },
        type: 'win_battles'
    }
];

const weeklyQuests = [
    {
        id: 'play_30_games',
        name: 'Weekly Gamer',
        description: 'Chơi 30 games trong tuần',
        emoji: '🎯',
        target: 30,
        reward: { coins: 1000, xp: 150 },
        type: 'play_games'
    },
    {
        id: 'reach_level_milestone',
        name: 'Level Up',
        description: 'Tăng 2 level trong tuần',
        emoji: '📈',
        target: 2,
        reward: { coins: 800, xp: 100 },
        type: 'level_up'
    }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quests')
        .setDescription('Xem và quản lý quest hàng ngày/tuần')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Hành động với quest')
                .setRequired(false)
                .addChoices(
                    { name: '📋 Xem Daily Quests', value: 'daily' },
                    { name: '📅 Xem Weekly Quests', value: 'weekly' },
                    { name: '🎁 Claim Rewards', value: 'claim' }
                )),

    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;
        const action = interaction.options.getString('action') || 'daily';

        await Database.createUser(userId, username);

        if (action === 'claim') {
            await this.claimQuests(interaction, userId);
        } else if (action === 'weekly') {
            await this.showWeeklyQuests(interaction, userId);
        } else {
            await this.showDailyQuests(interaction, userId);
        }
    },

    async showDailyQuests(interaction, userId) {
        const userQuests = await this.getUserQuests(userId, 'daily');
        const questProgress = await this.getQuestProgress(userId);

        const embed = new EmbedBuilder()
            .setTitle('📋 Daily Quests')
            .setDescription('Hoàn thành quest hàng ngày để nhận rewards!')
            .setColor('#00aaff');

        let completedCount = 0;

        for (const quest of dailyQuests) {
            const userQuest = userQuests.find(uq => uq.quest_id === quest.id);
            const progress = this.calculateProgress(quest, questProgress);
            const isCompleted = progress >= quest.target;
            const isClaimed = userQuest && userQuest.claimed;

            let status;
            let progressText;

            if (isClaimed) {
                status = '✅ Đã hoàn thành';
                progressText = `${quest.target}/${quest.target}`;
                completedCount++;
            } else if (isCompleted) {
                status = '🎁 Có thể claim!';
                progressText = `${quest.target}/${quest.target}`;
                completedCount++;
            } else {
                status = '🔄 Đang tiến hành';
                progressText = `${Math.min(progress, quest.target)}/${quest.target}`;
            }

            embed.addFields({
                name: `${quest.emoji} ${quest.name}`,
                value: `${quest.description}\n**Tiến độ:** ${progressText}\n**Reward:** ${quest.reward.coins} coins, ${quest.reward.xp} XP\n**Status:** ${status}`,
                inline: true
            });
        }

        embed.setFooter({ 
            text: `${completedCount}/${dailyQuests.length} completed | Reset vào 00:00 UTC`
        });

        await interaction.reply({ embeds: [embed] });
    },

    async showWeeklyQuests(interaction, userId) {
        const userQuests = await this.getUserQuests(userId, 'weekly');
        const questProgress = await this.getQuestProgress(userId);

        const embed = new EmbedBuilder()
            .setTitle('📅 Weekly Quests')
            .setDescription('Hoàn thành quest hàng tuần để nhận rewards lớn!')
            .setColor('#9932cc');

        let completedCount = 0;

        for (const quest of weeklyQuests) {
            const userQuest = userQuests.find(uq => uq.quest_id === quest.id);
            const progress = this.calculateProgress(quest, questProgress);
            const isCompleted = progress >= quest.target;
            const isClaimed = userQuest && userQuest.claimed;

            let status;
            let progressText;

            if (isClaimed) {
                status = '✅ Đã hoàn thành';
                progressText = `${quest.target}/${quest.target}`;
                completedCount++;
            } else if (isCompleted) {
                status = '🎁 Có thể claim!';
                progressText = `${quest.target}/${quest.target}`;
                completedCount++;
            } else {
                status = '🔄 Đang tiến hành';
                progressText = `${Math.min(progress, quest.target)}/${quest.target}`;
            }

            embed.addFields({
                name: `${quest.emoji} ${quest.name}`,
                value: `${quest.description}\n**Tiến độ:** ${progressText}\n**Reward:** ${quest.reward.coins} coins, ${quest.reward.xp} XP\n**Status:** ${status}`,
                inline: false
            });
        }

        embed.setFooter({ 
            text: `${completedCount}/${weeklyQuests.length} completed | Reset vào Chủ nhật`
        });

        await interaction.reply({ embeds: [embed] });
    },

    async claimQuests(interaction, userId) {
        const userQuests = await this.getUserQuests(userId, 'both');
        const questProgress = await this.getQuestProgress(userId);
        
        let totalCoins = 0;
        let totalXP = 0;
        let claimedQuests = [];
        
        // Check daily quests
        for (const quest of dailyQuests) {
            const userQuest = userQuests.find(uq => uq.quest_id === quest.id);
            const progress = this.calculateProgress(quest, questProgress);
            const isCompleted = progress >= quest.target;
            const isClaimed = userQuest && userQuest.claimed;
            
            if (isCompleted && !isClaimed) {
                await this.markQuestClaimed(userId, quest.id, 'daily');
                totalCoins += quest.reward.coins;
                totalXP += quest.reward.xp;
                claimedQuests.push(quest);
            }
        }
        
        // Check weekly quests
        for (const quest of weeklyQuests) {
            const userQuest = userQuests.find(uq => uq.quest_id === quest.id);
            const progress = this.calculateProgress(quest, questProgress);
            const isCompleted = progress >= quest.target;
            const isClaimed = userQuest && userQuest.claimed;
            
            if (isCompleted && !isClaimed) {
                await this.markQuestClaimed(userId, quest.id, 'weekly');
                totalCoins += quest.reward.coins;
                totalXP += quest.reward.xp;
                claimedQuests.push(quest);
            }
        }

        if (claimedQuests.length === 0) {
            return interaction.reply({ 
                content: '❌ Không có quest nào để claim!', 
                ephemeral: true 
            });
        }

        // Cập nhật database
        await Database.updateUserBalance(userId, totalCoins);
        await Database.updateUserXP(userId, totalXP);

        const embed = new EmbedBuilder()
            .setTitle('🎉 Quest Rewards Claimed!')
            .setDescription(`Bạn đã claim ${claimedQuests.length} quests!`)
            .addFields(
                { name: '💰 Total Coins', value: `+${totalCoins.toLocaleString()} coins`, inline: true },
                { name: '⭐ Total XP', value: `+${totalXP} XP`, inline: true }
            )
            .setColor('#00ff00');

        const questList = claimedQuests.map(q => 
            `${q.emoji} **${q.name}**`
        ).join('\n');

        embed.addFields({
            name: '📋 Quests Completed',
            value: questList,
            inline: false
        });

        await interaction.reply({ embeds: [embed] });
    },

    calculateProgress(quest, userProgress) {
        switch (quest.type) {
            case 'play_games':
                return userProgress.totalGames || 0;
            case 'earn_coins':
                return userProgress.coinsEarned || 0;
            case 'mining':
                return userProgress.miningCount || 0;
            case 'win_battles':
                return userProgress.battlesWon || 0;
            case 'level_up':
                return userProgress.levelsGained || 0;
            default:
                return 0;
        }
    },

    async getQuestProgress(userId) {
        // Lấy progress từ game stats (simplified)
        const games = ['rps', 'guess', 'trivia', 'slots', 'coinflip', 'mining', 'adventure'];
        let totalGames = 0;
        let battlesWon = 0;
        let miningCount = 0;

        for (const game of games) {
            const stats = await Database.getGameStats(userId, game);
            if (stats) {
                totalGames += stats.total_games;
                if (game === 'adventure') battlesWon += stats.wins;
                if (game === 'mining') miningCount += stats.total_games;
            }
        }

        return {
            totalGames,
            battlesWon,
            miningCount,
            coinsEarned: 1000, // Simplified - would need tracking
            levelsGained: 1 // Simplified - would need tracking
        };
    },

    async getUserQuests(userId, type) {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM user_quests WHERE user_id = ?';
            let params = [userId];
            
            if (type !== 'both') {
                query += ' AND quest_type = ?';
                params.push(type);
            }
            
            Database.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

    async markQuestClaimed(userId, questId, questType) {
        return new Promise((resolve, reject) => {
            Database.db.run(`
                INSERT OR REPLACE INTO user_quests (user_id, quest_id, quest_type, claimed, claimed_at)
                VALUES (?, ?, ?, 1, datetime('now'))
            `, [userId, questId, questType], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }
};