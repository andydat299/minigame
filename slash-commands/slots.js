const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Database = require('../database/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Chơi máy đánh bạc')
        .addIntegerOption(option =>
            option.setName('bet')
                .setDescription('Số tiền cược (tối thiểu 50 coins)')
                .setMinValue(50)
                .setRequired(false)),
    
    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;
        const betAmount = interaction.options.getInteger('bet') || 100;

        // Tạo user nếu chưa có
        await Database.createUser(userId, username);
        const user = await Database.getUser(userId);

        if (user.balance < betAmount) {
            return interaction.reply({ 
                content: '❌ Bạn không đủ tiền để cược!', 
                ephemeral: true 
            });
        }

        // Các biểu tượng slot
        const symbols = ['🍎', '🍌', '🍒', '🍇', '🍊', '⭐', '💎', '🍀'];
        const slot1 = symbols[Math.floor(Math.random() * symbols.length)];
        const slot2 = symbols[Math.floor(Math.random() * symbols.length)];
        const slot3 = symbols[Math.floor(Math.random() * symbols.length)];

        let multiplier = 0;
        let result = 'lose';

        // Tính toán kết quả
        if (slot1 === slot2 && slot2 === slot3) {
            // Ba giống nhau
            if (slot1 === '💎') multiplier = 10;
            else if (slot1 === '⭐') multiplier = 8;
            else if (slot1 === '🍀') multiplier = 6;
            else multiplier = 4;
            result = 'win';
        } else if (slot1 === slot2 || slot2 === slot3 || slot1 === slot3) {
            // Hai giống nhau
            multiplier = 2;
            result = 'win';
        }

        const winAmount = betAmount * multiplier;
        const netProfit = winAmount - betAmount;

        // Cập nhật balance
        await Database.updateUserBalance(userId, -betAmount); // Trừ tiền cược
        if (result === 'win') {
            await Database.updateUserBalance(userId, winAmount); // Thêm tiền thắng
        }

        // Cập nhật stats và XP
        await Database.updateGameStats(userId, 'slots', result);
        const xpGain = result === 'win' ? 15 : 5;
        await Database.updateUserXP(userId, xpGain);

        const embed = new EmbedBuilder()
            .setTitle('🎰 Máy đánh bạc')
            .setDescription(`🎯 **[ ${slot1} | ${slot2} | ${slot3} ]**`)
            .addFields(
                { name: '💰 Tiền cược', value: `${betAmount.toLocaleString()} coins`, inline: true },
                { name: '🎊 Kết quả', value: result === 'win' ? '🎉 THẮNG!' : '😢 THUA!', inline: true },
                { name: '💸 Thay đổi', value: result === 'win' ? `+${netProfit.toLocaleString()} coins` : `-${betAmount.toLocaleString()} coins`, inline: true }
            )
            .setColor(result === 'win' ? '#00ff00' : '#ff0000')
            .setFooter({ text: `Nhân x${multiplier} | +${xpGain} XP` });

        if (multiplier >= 6) {
            embed.setDescription(`🎯 **[ ${slot1} | ${slot2} | ${slot3} ]**\n\n🔥 **JACKPOT!** 🔥`);
        }

        await interaction.reply({ embeds: [embed] });
    }
};