const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Database = require('../database/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Xem số dư hiện tại'),
    
    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;

        // Tạo user nếu chưa có
        await Database.createUser(userId, username);
        const user = await Database.getUser(userId);

        if (!user) {
            return interaction.reply({ content: '❌ Không thể tải thông tin tài khoản!', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('💰 Số dư tài khoản')
            .setDescription(`**${user.balance.toLocaleString()} coins**`)
            .setColor('#00ff00')
            .setThumbnail(interaction.user.displayAvatarURL())
            .addFields(
                { name: '🏦 Tài khoản', value: interaction.user.username, inline: true },
                { name: '🏆 Level', value: `${Math.floor(user.xp / 100) + 1}`, inline: true },
                { name: '⭐ XP', value: `${user.xp}`, inline: true }
            )
            .setFooter({ text: 'Sử dụng /daily để nhận thêm coins hàng ngày!' });

        await interaction.reply({ embeds: [embed] });
    }
};