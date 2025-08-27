const { EmbedBuilder } = require('discord.js');
const Database = require('../database/database');

module.exports = {
    name: 'coinflip',
    description: 'Tung đồng xu đoán mặt ngửa/sấp',
    async execute(message, args, client) {
        if (!args[0]) {
            return message.reply('❌ Vui lòng chọn: `!coinflip heads` hoặc `!coinflip tails`');
        }

        const choices = ['heads', 'tails'];
        const userChoice = args[0].toLowerCase();

        if (!choices.includes(userChoice)) {
            return message.reply('❌ Lựa chọn không hợp lệ! Chọn: heads hoặc tails');
        }

        const userId = message.author.id;
        const username = message.author.username;
        const betAmount = parseInt(args[1]) || 100;

        // Tạo user nếu chưa có
        await Database.createUser(userId, username);
        const user = await Database.getUser(userId);

        if (betAmount < 50) {
            return message.reply('❌ Số tiền cược tối thiểu là 50 coins!');
        }

        if (user.balance < betAmount) {
            return message.reply('❌ Bạn không đủ tiền để cược!');
        }

        const result = choices[Math.floor(Math.random() * 2)];
        const won = userChoice === result;

        // Cập nhật balance
        await Database.updateUserBalance(userId, -betAmount); // Trừ tiền cược
        if (won) {
            await Database.updateUserBalance(userId, betAmount * 2); // Trả gấp đôi nếu thắng
        }

        // Cập nhật stats và XP
        await Database.updateGameStats(userId, 'coinflip', won ? 'win' : 'lose');
        const xpGain = won ? 10 : 3;
        await Database.updateUserXP(userId, xpGain);

        const emojis = {
            heads: '👑',
            tails: '⭐'
        };

        const embed = new EmbedBuilder()
            .setTitle('🪙 Tung đồng xu')
            .addFields(
                { name: '👤 Bạn chọn', value: `${emojis[userChoice]} ${userChoice}`, inline: true },
                { name: '🎯 Kết quả', value: `${emojis[result]} ${result}`, inline: true },
                { name: '🏆 Trạng thái', value: won ? '🎉 THẮNG!' : '😢 THUA!', inline: true },
                { name: '💰 Tiền cược', value: `${betAmount.toLocaleString()} coins`, inline: true },
                { name: '💸 Thay đổi', value: won ? `+${betAmount.toLocaleString()} coins` : `-${betAmount.toLocaleString()} coins`, inline: true },
                { name: '⭐ XP', value: `+${xpGain} XP`, inline: true }
            )
            .setColor(won ? '#00ff00' : '#ff0000')
            .setFooter({ text: 'Chơi lại với !coinflip <heads/tails> [số tiền]' });

        message.reply({ embeds: [embed] });
    }
};