const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Database = require('../database/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guess')
        .setDescription('Đoán số từ 1-100')
        .addIntegerOption(option =>
            option.setName('number')
                .setDescription('Số bạn đoán (1-100)')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(false)),
    
    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;
        const userGuess = interaction.options.getInteger('number');

        // Tạo user nếu chưa có
        await Database.createUser(userId, username);

        if (!userGuess) {
            // Bắt đầu game mới
            const targetNumber = Math.floor(Math.random() * 100) + 1;
            
            await this.saveGuessGame(userId, targetNumber, 0);

            const embed = new EmbedBuilder()
                .setTitle('🎯 Trò chơi đoán số!')
                .setDescription(`Tôi đã nghĩ ra một số từ **1 đến 100**.\nBạn có **7 lần đoán** để tìm ra số đó!\n\nSử dụng \`/guess number:<số bạn đoán>\` để đoán.`)
                .setColor('#0099ff')
                .setFooter({ text: 'Game sẽ hết hạn sau 10 phút!' });

            return interaction.reply({ embeds: [embed] });
        }

        // Xử lý lượt đoán
        const gameState = await this.getGuessGame(userId);
        
        if (!gameState) {
            return interaction.reply({ 
                content: '❌ Không có game nào đang diễn ra! Sử dụng `/guess` để bắt đầu game mới.', 
                ephemeral: true 
            });
        }

        const attempts = gameState.attempts + 1;
        const maxAttempts = 7;
        const targetNumber = gameState.target_number;

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

            await this.deleteGuessGame(userId);
            return interaction.reply({ embeds: [winEmbed] });
        }

        if (attempts >= maxAttempts) {
            // Hết lượt
            await Database.updateGameStats(userId, 'guess', 'lose');

            const loseEmbed = new EmbedBuilder()
                .setTitle('😢 Hết lượt đoán!')
                .setDescription(`Số tôi nghĩ ra là **${targetNumber}**.\nBạn đã dùng hết ${maxAttempts} lần đoán!`)
                .setColor('#ff0000')
                .setFooter({ text: 'Thử lại với /guess' });

            await this.deleteGuessGame(userId);
            return interaction.reply({ embeds: [loseEmbed] });
        }

        // Gợi ý và cập nhật attempts
        await this.updateGuessAttempts(userId, attempts);
        
        const hint = userGuess < targetNumber ? 'lớn hơn' : 'nhỏ hơn';
        const hintEmbed = new EmbedBuilder()
            .setTitle(`${userGuess < targetNumber ? '📈' : '📉'} Sai rồi!`)
            .setDescription(`Số tôi nghĩ ra **${hint}** ${userGuess}`)
            .addFields(
                { name: '🎯 Lần thử', value: `${attempts}/${maxAttempts}`, inline: true },
                { name: '🔄 Còn lại', value: `${maxAttempts - attempts} lần`, inline: true }
            )
            .setColor('#ffaa00')
            .setFooter({ text: `Tiếp tục với /guess number:<số tiếp theo>` });

        await interaction.reply({ embeds: [hintEmbed] });
    },

    async saveGuessGame(userId, targetNumber, attempts) {
        return new Promise((resolve, reject) => {
            Database.db.run(`
                INSERT OR REPLACE INTO user_guess_games (user_id, target_number, attempts, created_at)
                VALUES (?, ?, ?, datetime('now'))
            `, [userId, targetNumber, attempts], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    },

    async getGuessGame(userId) {
        return new Promise((resolve, reject) => {
            Database.db.get(
                'SELECT * FROM user_guess_games WHERE user_id = ? AND created_at > datetime("now", "-10 minutes")',
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    },

    async updateGuessAttempts(userId, attempts) {
        return new Promise((resolve, reject) => {
            Database.db.run(
                'UPDATE user_guess_games SET attempts = ? WHERE user_id = ?',
                [attempts, userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    },

    async deleteGuessGame(userId) {
        return new Promise((resolve, reject) => {
            Database.db.run(
                'DELETE FROM user_guess_games WHERE user_id = ?',
                [userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }
};