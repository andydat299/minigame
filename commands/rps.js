const { EmbedBuilder } = require('discord.js');
const Database = require('../database/database');

module.exports = {
    name: 'rps',
    description: 'Chơi kéo búa bao với bot',
    async execute(message, args, client) {
        if (!args[0]) {
            return message.reply('❌ Vui lòng chọn: `!rps rock`, `!rps paper`, hoặc `!rps scissors`');
        }

        const choices = ['rock', 'paper', 'scissors'];
        const userChoice = args[0].toLowerCase();

        if (!choices.includes(userChoice)) {
            return message.reply('❌ Lựa chọn không hợp lệ! Chọn: rock, paper, hoặc scissors');
        }

        const userId = message.author.id;
        const username = message.author.username;

        // Tạo user nếu chưa có
        await Database.createUser(userId, username);

        const botChoice = choices[Math.floor(Math.random() * choices.length)];
        
        // Emoji cho từng lựa chọn
        const emojis = {
            rock: '🗿',
            paper: '📄',
            scissors: '✂️'
        };

        let result;
        let reward = 0;
        let xpGain = 0;

        if (userChoice === botChoice) {
            result = 'draw';
            reward = 50;
            xpGain = 5;
        } else if (
            (userChoice === 'rock' && botChoice === 'scissors') ||
            (userChoice === 'paper' && botChoice === 'rock') ||
            (userChoice === 'scissors' && botChoice === 'paper')
        ) {
            result = 'win';
            reward = 150;
            xpGain = 15;
        } else {
            result = 'lose';
            reward = 0;
            xpGain = 2;
        }

        // Cập nhật database
        await Database.updateUserBalance(userId, reward);
        await Database.updateUserXP(userId, xpGain);
        await Database.updateGameStats(userId, 'rps', result);

        const resultText = {
            win: '🎉 **BẠN THẮNG!**',
            lose: '😢 **BẠN THUA!**',
            draw: '🤝 **HÒA!**'
        };

        const embed = new EmbedBuilder()
            .setTitle('🎮 Kéo Búa Bao')
            .addFields(
                { name: '👤 Bạn chọn', value: `${emojis[userChoice]} ${userChoice}`, inline: true },
                { name: '🤖 Bot chọn', value: `${emojis[botChoice]} ${botChoice}`, inline: true },
                { name: '🏆 Kết quả', value: resultText[result], inline: true },
                { name: '💰 Phần thưởng', value: `${reward} coins`, inline: true },
                { name: '⭐ XP', value: `+${xpGain} XP`, inline: true }
            )
            .setColor(result === 'win' ? '#00ff00' : result === 'lose' ? '#ff0000' : '#ffff00')
            .setFooter({ text: 'Chơi lại với !rps <rock/paper/scissors>' });

        message.reply({ embeds: [embed] });
    }
};