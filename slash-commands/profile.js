const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Database = require('../database/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Xem thông tin profile của bạn'),
    
    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;

        // Tạo user nếu chưa có
        await Database.createUser(userId, username);
        const user = await Database.getUser(userId);

        if (!user) {
            return interaction.reply({ content: '❌ Không thể tải thông tin profile!', ephemeral: true });
        }

        // Tính toán level dựa trên XP
        const currentLevel = Math.floor(user.xp / 100) + 1;
        const xpForNextLevel = (currentLevel * 100) - user.xp;

        const embed = new EmbedBuilder()
            .setTitle(`👤 Profile của ${username}`)
            .setColor('#00ff00')
            .setThumbnail(interaction.user.displayAvatarURL())
            .addFields(
                { name: '💰 Số dư', value: `${user.balance.toLocaleString()} coins`, inline: true },
                { name: '🏆 Level', value: `${currentLevel}`, inline: true },
                { name: '⭐ XP', value: `${user.xp}/${currentLevel * 100}`, inline: true },
                { name: '📈 XP cần cho level tiếp', value: `${xpForNextLevel}`, inline: true },
                { name: '📅 Tham gia', value: `<t:${Math.floor(new Date(user.created_at).getTime() / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: 'Sử dụng /help để xem các lệnh khác' });

        await interaction.reply({ embeds: [embed] });
    }
};