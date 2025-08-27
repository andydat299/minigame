const { EmbedBuilder } = require('discord.js');
const Database = require('../database/database');

module.exports = {
    name: 'leaderboard',
    description: 'Xem bảng xếp hạng',
    async execute(message, args, client) {
        const type = args[0]?.toLowerCase() || 'balance';

        try {
            let query;
            let title;
            let description;

            switch (type) {
                case 'balance':
                case 'coins':
                    query = 'SELECT id, username, balance FROM users ORDER BY balance DESC LIMIT 10';
                    title = '💰 Bảng xếp hạng Balance';
                    description = 'Top 10 người dùng giàu nhất';
                    break;
                
                case 'level':
                case 'xp':
                    query = 'SELECT id, username, xp, (xp / 100 + 1) as level FROM users ORDER BY xp DESC LIMIT 10';
                    title = '🏆 Bảng xếp hạng Level';
                    description = 'Top 10 người dùng level cao nhất';
                    break;
                
                default:
                    return message.reply('❌ Loại bảng xếp hạng không hợp lệ! Sử dụng: `balance` hoặc `level`');
            }

            Database.db.all(query, [], (err, rows) => {
                if (err) {
                    console.error('Leaderboard error:', err);
                    return message.reply('❌ Có lỗi xảy ra khi tải bảng xếp hạng!');
                }

                if (!rows || rows.length === 0) {
                    return message.reply('❌ Chưa có dữ liệu cho bảng xếp hạng!');
                }

                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(description)
                    .setColor('#ffd700')
                    .setTimestamp();

                let leaderboardText = '';
                const medals = ['🥇', '🥈', '🥉'];

                rows.forEach((user, index) => {
                    const rank = index + 1;
                    const medal = rank <= 3 ? medals[index] : `${rank}.`;
                    
                    let value;
                    if (type === 'balance' || type === 'coins') {
                        value = `${user.balance.toLocaleString()} coins`;
                    } else {
                        value = `Level ${Math.floor(user.level)} (${user.xp} XP)`;
                    }

                    leaderboardText += `${medal} **${user.username}** - ${value}\n`;
                });

                embed.addFields({
                    name: '🏆 Bảng xếp hạng',
                    value: leaderboardText,
                    inline: false
                });

                // Tìm vị trí của user hiện tại
                const userId = message.author.id;
                let userRankQuery;
                
                if (type === 'balance' || type === 'coins') {
                    userRankQuery = `
                        SELECT COUNT(*) + 1 as rank 
                        FROM users 
                        WHERE balance > (SELECT balance FROM users WHERE id = ?)
                    `;
                } else {
                    userRankQuery = `
                        SELECT COUNT(*) + 1 as rank 
                        FROM users 
                        WHERE xp > (SELECT xp FROM users WHERE id = ?)
                    `;
                }

                Database.db.get(userRankQuery, [userId], (err, rankResult) => {
                    if (!err && rankResult) {
                        embed.setFooter({ 
                            text: `Vị trí của bạn: #${rankResult.rank} | Dùng !leaderboard [balance/level]`,
                            iconURL: message.author.displayAvatarURL()
                        });
                    }

                    message.reply({ embeds: [embed] });
                });
            });

        } catch (error) {
            console.error('Leaderboard error:', error);
            message.reply('❌ Có lỗi xảy ra khi tải bảng xếp hạng!');
        }
    }
};