const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Hiển thị danh sách các lệnh'),
    
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🤖 Danh sách lệnh Bot')
            .setDescription('Dưới đây là tất cả các lệnh có sẵn:')
            .setColor('#0099ff')
            .addFields(
                {
                    name: '👤 **Thông tin cá nhân**',
                    value: '`/profile` - Xem thông tin profile\n`/daily` - Nhận phần thưởng hàng ngày\n`/balance` - Xem số dư',
                    inline: false
                },
                {
                    name: '🎮 **Minigames**',
                    value: '`/rps <choice>` - Kéo búa bao\n`/guess [number]` - Đoán số\n`/trivia [answer]` - Câu hỏi vui\n`/slots [bet]` - Máy đánh bạc\n`/coinflip <choice> [bet]` - Tung đồng xu\n`/mining` - Đào đá kiếm coins\n`/adventure [action]` - Phiêu lưu chiến đấu boss\n`/sicbo [action]` - Tài xỉu tự động',
                    inline: false
                },
                {
                    name: '🛒 **Cửa hàng & Economy**',
                    value: '`/shop [category]` - Xem cửa hàng\n`/buy <item> [quantity]` - Mua vật phẩm\n`/inventory` - Xem kho đồ\n`/pickaxe [action]` - Quản lý cuốc đào',
                    inline: false
                },
                {
                    name: '📊 **Thống kê & Progression**',
                    value: '`/stats` - Xem thống kê game\n`/leaderboard [type]` - Bảng xếp hạng\n`/achievements [action]` - Thành tích & rewards\n`/quests [action]` - Quest hàng ngày/tuần',
                    inline: false
                },
                {
                    name: '🎯 **Lệnh Prefix (!)**',
                    value: 'Bạn vẫn có thể sử dụng lệnh prefix với `!` như: `!help`, `!mining`, `!rps rock`',
                    inline: false
                }
            )
            .setFooter({ 
                text: 'Slash Commands: / | Prefix Commands: ! | Bot được tạo bởi GitHub Copilot',
                iconURL: interaction.client.user.displayAvatarURL()
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};