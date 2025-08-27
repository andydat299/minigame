const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Database = require('../database/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Xem thống kê game của bạn'),
    
    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;

        await Database.createUser(userId, username);

        // Lấy stats cho tất cả games
        const games = ['rps', 'guess', 'trivia', 'slots', 'coinflip', 'mining', 'adventure', 'sicbo'];
        const statsPromises = games.map(game => 
            Database.getGameStats(userId, game)
        );

        try {
            const allStats = await Promise.all(statsPromises);
            
            const embed = new EmbedBuilder()
                .setTitle(`📊 Thống kê game của ${username}`)
                .setColor('#9932cc')
                .setThumbnail(interaction.user.displayAvatarURL());

            let totalGames = 0;
            let totalWins = 0;
            let totalLosses = 0;
            let totalDraws = 0;

            games.forEach((game, index) => {
                const stat = allStats[index];
                if (stat) {
                    const winRate = stat.total_games > 0 ? 
                        ((stat.wins / stat.total_games) * 100).toFixed(1) : '0.0';

                    const gameEmojis = {
                        'rps': '✂️',
                        'guess': '🎯',
                        'trivia': '🧠',
                        'slots': '🎰',
                        'coinflip': '🪙',
                        'mining': '⛏️',
                        'adventure': '⚔️',
                        'sicbo': '🎲'
                    };

                    const gameNames = {
                        'rps': 'Kéo Búa Bao',
                        'guess': 'Đoán Số',
                        'trivia': 'Câu Hỏi Vui',
                        'slots': 'Máy Đánh Bạc',
                        'coinflip': 'Tung Đồng Xu',
                        'mining': 'Đào Đá',
                        'adventure': 'Phiêu Lưu',
                        'sicbo': 'Tài Xỉu'
                    };

                    embed.addFields({
                        name: `${gameEmojis[game]} ${gameNames[game]}`,
                        value: `🎮 ${stat.total_games} games | 🏆 ${stat.wins}W ${stat.losses}L ${stat.draws}D | 📈 ${winRate}%`,
                        inline: false
                    });

                    totalGames += stat.total_games;
                    totalWins += stat.wins;
                    totalLosses += stat.losses;
                    totalDraws += stat.draws;
                }
            });

            const overallWinRate = totalGames > 0 ? 
                ((totalWins / totalGames) * 100).toFixed(1) : '0.0';

            embed.addFields({
                name: '🏆 Tổng kết',
                value: `🎮 **${totalGames}** games tổng | 🎯 **${overallWinRate}%** win rate\n🏆 **${totalWins}** thắng | 😢 **${totalLosses}** thua | 🤝 **${totalDraws}** hòa`,
                inline: false
            });

            if (totalGames === 0) {
                embed.setDescription('Bạn chưa chơi game nào! Hãy thử các lệnh: /rps, /guess, /trivia, /slots, /coinflip, /mining, /adventure, /sicbo');
            }

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Stats error:', error);
            await interaction.reply({ content: '❌ Có lỗi xảy ra khi tải thống kê!', ephemeral: true });
        }
    }
};