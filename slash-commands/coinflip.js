const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Database = require('../database/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Tung đồng xu đoán mặt ngửa/sấp')
        .addStringOption(option =>
            option.setName('choice')
                .setDescription('Chọn mặt đồng xu')
                .setRequired(true)
                .addChoices(
                    { name: '👑 Heads (Ngửa)', value: 'heads' },
                    { name: '⭐ Tails (Sấp)', value: 'tails' }
                ))
        .addIntegerOption(option =>
            option.setName('bet')
                .setDescription('Số tiền cược (tối thiểu 50 coins)')
                .setMinValue(50)
                .setRequired(false)),
    
    async execute(interaction) {
        const userChoice = interaction.options.getString('choice');
        const betAmount = interaction.options.getInteger('bet') || 100;
        const userId = interaction.user.id;
        const username = interaction.user.username;

        // Tạo user nếu chưa có
        await Database.createUser(userId, username);
        const user = await Database.getUser(userId);

        if (user.balance < betAmount) {
            return interaction.reply({ content: '❌ Bạn không đủ tiền để cược!', ephemeral: true });
        }

        const choices = ['heads', 'tails'];
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
            .setFooter({ text: 'Chơi lại với /coinflip' });

        await interaction.reply({ embeds: [embed] });
    }
};