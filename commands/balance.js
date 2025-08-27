const { EmbedBuilder } = require('discord.js');
const Database = require('../database/database');

module.exports = {
    name: 'balance',
    description: 'Xem số dư hiện tại',
    async execute(message, args, client) {
        const userId = message.author.id;
        const username = message.author.username;

        // Tạo user nếu chưa có
        await Database.createUser(userId, username);
        const user = await Database.getUser(userId);

        if (!user) {
            return message.reply('❌ Không thể tải thông tin tài khoản!');
        }

        const embed = new EmbedBuilder()
            .setTitle('💰 Số dư tài khoản')
            .setDescription(`**${user.balance.toLocaleString()} coins**`)
            .setColor('#00ff00')
            .setThumbnail(message.author.displayAvatarURL())
            .addFields(
                { name: '🏦 Tài khoản', value: message.author.username, inline: true },
                { name: '🏆 Level', value: `${Math.floor(user.xp / 100) + 1}`, inline: true },
                { name: '⭐ XP', value: `${user.xp}`, inline: true }
            )
            .setFooter({ text: 'Sử dụng !daily để nhận thêm coins hàng ngày!' });

        message.reply({ embeds: [embed] });
    }
};