const { EmbedBuilder } = require('discord.js');
const Database = require('../database/database');

module.exports = {
    name: 'guess',
    description: 'Đoán số từ 1-100',
    async execute(message, args, client) {
        const userId = message.author.id;
        const username = message.author.username;

        // Tạo user nếu chưa có
        await Database.createUser(userId, username);

        const targetNumber = Math.floor(Math.random() * 100) + 1;
        let attempts = 0;
        const maxAttempts = 7;

        const embed = new EmbedBuilder()
            .setTitle('🎯 Trò chơi đoán số!')
            .setDescription(`Tôi đã nghĩ ra một số từ **1 đến 100**.\nBạn có **${maxAttempts} lần đoán** để tìm ra số đó!\n\nGửi số bạn đoán vào chat.`)
            .setColor('#0099ff')
            .setFooter({ text: 'Bạn có 60 giây để hoàn thành!' });

        const gameMessage = await message.reply({ embeds: [embed] });

        const filter = (response) => {
            const num = parseInt(response.content);
            return response.author.id === userId && !isNaN(num) && num >= 1 && num <= 100;
        };

        const collector = message.channel.createMessageCollector({ 
            filter, 
            time: 60000,
            max: maxAttempts
        });

        collector.on('collect', async (guess) => {
            attempts++;
            const userGuess = parseInt(guess.content);

            if (userGuess === targetNumber) {
                // Thắng
                const reward = Math.max(200 - (attempts * 20), 50);
                const xpGain = Math.max(20 - (attempts * 2), 5);

                await Database.updateUserBalance(userId, reward);
                await Database.updateUserXP(userId, xpGain);
                await Database.updateGameStats(userId, 'guess', 'win');

                const winEmbed = new EmbedBuilder()
                    .setTitle('🎉 CHÍNH XÁC!')
                    .setDescription(`Số tôi nghĩ ra là **${targetNumber}**!\nBạn đã đoán đúng trong **${attempts}** lần thử!`)
                    .addFields(
                        { name: '💰 Phần thưởng', value: `${reward} coins`, inline: true },
                        { name: '⭐ XP', value: `+${xpGain} XP`, inline: true },
                        { name: '🎯 Lần thử', value: `${attempts}/${maxAttempts}`, inline: true }
                    )
                    .setColor('#00ff00');

                collector.stop();
                return guess.reply({ embeds: [winEmbed] });
            }

            if (attempts >= maxAttempts) {
                // Hết lượt
                await Database.updateGameStats(userId, 'guess', 'lose');

                const loseEmbed = new EmbedBuilder()
                    .setTitle('😢 Hết lượt đoán!')
                    .setDescription(`Số tôi nghĩ ra là **${targetNumber}**.\nBạn đã dùng hết ${maxAttempts} lần đoán!`)
                    .setColor('#ff0000')
                    .setFooter({ text: 'Thử lại với !guess' });

                collector.stop();
                return guess.reply({ embeds: [loseEmbed] });
            }

            // Gợi ý
            const hint = userGuess < targetNumber ? 'lớn hơn' : 'nhỏ hơn';
            const hintEmbed = new EmbedBuilder()
                .setTitle(`${userGuess < targetNumber ? '📈' : '📉'} Sai rồi!`)
                .setDescription(`Số tôi nghĩ ra **${hint}** ${userGuess}`)
                .addFields(
                    { name: '🎯 Lần thử', value: `${attempts}/${maxAttempts}`, inline: true },
                    { name: '🔄 Còn lại', value: `${maxAttempts - attempts} lần`, inline: true }
                )
                .setColor('#ffaa00');

            guess.reply({ embeds: [hintEmbed] });
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                await Database.updateGameStats(userId, 'guess', 'lose');

                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏰ Hết thời gian!')
                    .setDescription(`Số tôi nghĩ ra là **${targetNumber}**.\nBạn đã hết thời gian!`)
                    .setColor('#ff0000')
                    .setFooter({ text: 'Thử lại với !guess' });

                gameMessage.edit({ embeds: [timeoutEmbed] });
            }
        });
    }
};