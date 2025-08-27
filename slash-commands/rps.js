const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Database = require('../database/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Chơi kéo búa bao với bot')
        .addStringOption(option =>
            option.setName('choice')
                .setDescription('Lựa chọn của bạn')
                .setRequired(true)
                .addChoices(
                    { name: '🗿 Rock', value: 'rock' },
                    { name: '📄 Paper', value: 'paper' },
                    { name: '✂️ Scissors', value: 'scissors' }
                )),
    
    async execute(interaction) {
        const userChoice = interaction.options.getString('choice');
        const userId = interaction.user.id;
        const username = interaction.user.username;

        // Tạo user nếu chưa có
        await Database.createUser(userId, username);

        const choices = ['rock', 'paper', 'scissors'];
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
            .setFooter({ text: 'Chơi lại với /rps' });

        await interaction.reply({ embeds: [embed] });
    }
};