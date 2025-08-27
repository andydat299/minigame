const { EmbedBuilder } = require('discord.js');
const Database = require('../database/database');

module.exports = {
    name: 'daily',
    description: 'Nhận phần thưởng hàng ngày',
    async execute(message, args, client) {
        const userId = message.author.id;
        const username = message.author.username;

        // Tạo user nếu chưa có
        await Database.createUser(userId, username);
        const user = await Database.getUser(userId);

        const today = new Date().toDateString();
        const lastClaimed = user.daily_claimed;

        if (lastClaimed === today) {
            const embed = new EmbedBuilder()
                .setTitle('⏰ Đã nhận daily hôm nay!')
                .setDescription('Bạn đã nhận phần thưởng hàng ngày rồi. Quay lại vào ngày mai!')
                .setColor('#ff0000');
            
            return message.reply({ embeds: [embed] });
        }

        // Tính phần thưởng daily
        const baseReward = 500;
        const levelBonus = Math.floor(user.xp / 100) * 50;
        const totalReward = baseReward + levelBonus;

        // Cập nhật database
        await Database.updateUserBalance(userId, totalReward);
        await Database.updateUserXP(userId, 25);

        // Cập nhật daily_claimed
        Database.db.run(
            'UPDATE users SET daily_claimed = ? WHERE id = ?',
            [today, userId]
        );

        const embed = new EmbedBuilder()
            .setTitle('🎁 Phần thưởng hàng ngày!')
            .setDescription(`Bạn đã nhận được **${totalReward.toLocaleString()} coins** và **25 XP**!`)
            .addFields(
                { name: '💰 Phần thưởng cơ bản', value: `${baseReward.toLocaleString()} coins`, inline: true },
                { name: '🏆 Bonus level', value: `${levelBonus.toLocaleString()} coins`, inline: true },
                { name: '⭐ XP nhận được', value: '25 XP', inline: true }
            )
            .setColor('#00ff00')
            .setFooter({ text: 'Quay lại vào ngày mai để nhận thêm!' });

        message.reply({ embeds: [embed] });
    }
};