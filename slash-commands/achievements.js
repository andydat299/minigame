const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Database = require('../database/database');

// Achievements định nghĩa
const achievements = [
    {
        id: 'first_win',
        name: 'First Victory',
        description: 'Thắng game đầu tiên',
        emoji: '🥇',
        reward: { coins: 100, xp: 20 },
        condition: (stats) => stats.totalWins >= 1
    },
    {
        id: 'rich_player',
        name: 'Rich Player',
        description: 'Có 10,000 coins',
        emoji: '💰',
        reward: { coins: 500, xp: 50 },
        condition: (stats) => stats.balance >= 10000
    },
    {
        id: 'mining_expert',
        name: 'Mining Expert',
        description: 'Đào thành công 50 lần',
        emoji: '⛏️',
        reward: { coins: 300, xp: 75 },
        condition: (stats) => stats.miningWins >= 50
    },
    {
        id: 'level_master',
        name: 'Level Master',
        description: 'Đạt level 20',
        emoji: '🏆',
        reward: { coins: 1000, xp: 100 },
        condition: (stats) => stats.level >= 20
    },
    {
        id: 'lucky_gambler',
        name: 'Lucky Gambler',
        description: 'Thắng 20 game may rủi',
        emoji: '🍀',
        reward: { coins: 400, xp: 60 },
        condition: (stats) => (stats.slotsWins + stats.coinflipWins) >= 20
    },
    {
        id: 'brain_power',
        name: 'Brain Power',
        description: 'Trả lời đúng 30 câu trivia',
        emoji: '🧠',
        reward: { coins: 250, xp: 80 },
        condition: (stats) => stats.triviaWins >= 30
    },
    {
        id: 'warrior',
        name: 'Warrior',
        description: 'Đánh bại 10 boss',
        emoji: '⚔️',
        reward: { coins: 800, xp: 120 },
        condition: (stats) => stats.adventureWins >= 10
    },
    {
        id: 'millionaire',
        name: 'Millionaire',
        description: 'Có 100,000 coins',
        emoji: '💎',
        reward: { coins: 2000, xp: 200 },
        condition: (stats) => stats.balance >= 100000
    }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('achievements')
        .setDescription('Xem thành tích và rewards')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Hành động với achievements')
                .setRequired(false)
                .addChoices(
                    { name: '📋 Xem tất cả', value: 'list' },
                    { name: '🎁 Claim rewards', value: 'claim' }
                )),

    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;
        const action = interaction.options.getString('action') || 'list';

        await Database.createUser(userId, username);

        if (action === 'claim') {
            await this.claimAchievements(interaction, userId);
        } else {
            await this.showAchievements(interaction, userId);
        }
    },

    async showAchievements(interaction, userId) {
        const userStats = await this.getUserStats(userId);
        const userAchievements = await this.getUserAchievements(userId);
        
        const embed = new EmbedBuilder()
            .setTitle('🏆 Thành tích & Achievements')
            .setDescription('Hoàn thành thành tích để nhận rewards!')
            .setColor('#ffd700');

        let completedCount = 0;
        let claimableCount = 0;

        for (const achievement of achievements) {
            const isCompleted = achievement.condition(userStats);
            const isClaimed = userAchievements.includes(achievement.id);
            
            let status;
            if (isClaimed) {
                status = '✅ Đã claim';
                completedCount++;
            } else if (isCompleted) {
                status = '🎁 Có thể claim!';
                claimableCount++;
                completedCount++;
            } else {
                status = '❌ Chưa hoàn thành';
            }

            embed.addFields({
                name: `${achievement.emoji} ${achievement.name}`,
                value: `${achievement.description}\n💰 ${achievement.reward.coins} coins, ⭐ ${achievement.reward.xp} XP\n**${status}**`,
                inline: true
            });
        }

        embed.setFooter({ 
            text: `${completedCount}/${achievements.length} hoàn thành | ${claimableCount} có thể claim` 
        });

        if (claimableCount > 0) {
            embed.setDescription(`Hoàn thành thành tích để nhận rewards!\n\n🎁 **Bạn có ${claimableCount} achievement có thể claim!**\nSử dụng \`/achievements claim\` để nhận rewards.`);
        }

        await interaction.reply({ embeds: [embed] });
    },

    async claimAchievements(interaction, userId) {
        const userStats = await this.getUserStats(userId);
        const userAchievements = await this.getUserAchievements(userId);
        
        let totalCoins = 0;
        let totalXP = 0;
        let claimedAchievements = [];

        for (const achievement of achievements) {
            const isCompleted = achievement.condition(userStats);
            const isClaimed = userAchievements.includes(achievement.id);
            
            if (isCompleted && !isClaimed) {
                // Claim achievement
                await this.saveUserAchievement(userId, achievement.id);
                totalCoins += achievement.reward.coins;
                totalXP += achievement.reward.xp;
                claimedAchievements.push(achievement);
            }
        }

        if (claimedAchievements.length === 0) {
            return interaction.reply({ 
                content: '❌ Không có achievement nào để claim!', 
                ephemeral: true 
            });
        }

        // Cập nhật database
        await Database.updateUserBalance(userId, totalCoins);
        await Database.updateUserXP(userId, totalXP);

        const embed = new EmbedBuilder()
            .setTitle('🎉 Claimed Achievements!')
            .setDescription(`Bạn đã claim ${claimedAchievements.length} achievements!`)
            .addFields(
                { name: '💰 Total Coins', value: `+${totalCoins.toLocaleString()} coins`, inline: true },
                { name: '⭐ Total XP', value: `+${totalXP} XP`, inline: true }
            )
            .setColor('#00ff00');

        // Liệt kê achievements đã claim
        const achievementList = claimedAchievements.map(a => 
            `${a.emoji} **${a.name}**`
        ).join('\n');

        embed.addFields({
            name: '🏆 Achievements Claimed',
            value: achievementList,
            inline: false
        });

        await interaction.reply({ embeds: [embed] });
    },

    async getUserStats(userId) {
        const user = await Database.getUser(userId);
        const level = Math.floor(user.xp / 100) + 1;
        
        // Lấy game stats
        const gameStats = {};
        const games = ['rps', 'guess', 'trivia', 'slots', 'coinflip', 'mining', 'adventure'];
        
        for (const game of games) {
            const stats = await Database.getGameStats(userId, game);
            gameStats[`${game}Wins`] = stats ? stats.wins : 0;
        }

        const totalWins = Object.values(gameStats).reduce((sum, wins) => sum + wins, 0);

        return {
            balance: user.balance,
            level: level,
            totalWins: totalWins,
            ...gameStats
        };
    },

    async getUserAchievements(userId) {
        return new Promise((resolve, reject) => {
            Database.db.all(
                'SELECT achievement_id FROM user_achievements WHERE user_id = ?',
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows.map(row => row.achievement_id));
                }
            );
        });
    },

    async saveUserAchievement(userId, achievementId) {
        return new Promise((resolve, reject) => {
            Database.db.run(
                'INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
                [userId, achievementId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }
};