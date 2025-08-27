const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Database = require('../database/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Xem bảng xếp hạng')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Loại bảng xếp hạng')
                .setRequired(false)
                .addChoices(
                    { name: '💰 Balance (Coins)', value: 'balance' },
                    { name: '🏆 Level (XP)', value: 'level' }
                )),
    
    async execute(interaction) {
        const type = interaction.options.getString('type') || 'balance';

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
                    return interaction.reply({ content: '❌ Loại bảng xếp hạng không hợp lệ!', ephemeral: true });
            }

            Database.db.all(query, [], async (err, rows) => {
                if (err) {
                    console.error('Leaderboard error:', err);
                    return interaction.reply({ content: '❌ Có lỗi xảy ra khi tải bảng xếp hạng!', ephemeral: true });
                }

                if (!rows || rows.length === 0) {
                    return interaction.reply({ content: '❌ Chưa có dữ liệu cho bảng xếp hạng!', ephemeral: true });
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
                const userId = interaction.user.id;
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

                Database.db.get(userRankQuery, [userId], async (err, rankResult) => {
                    if (!err && rankResult) {
                        embed.setFooter({ 
                            text: `Vị trí của bạn: #${rankResult.rank} | Dùng /leaderboard với type khác`,
                            iconURL: interaction.user.displayAvatarURL()
                        });
                    }

                    await interaction.reply({ embeds: [embed] });
                });
            });

        } catch (error) {
            console.error('Leaderboard error:', error);
            await interaction.reply({ content: '❌ Có lỗi xảy ra khi tải bảng xếp hạng!', ephemeral: true });
        }
    }
};