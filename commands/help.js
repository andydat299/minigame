const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    description: 'Hiển thị danh sách các lệnh',
    async execute(message, args, client) {
        const embed = new EmbedBuilder()
            .setTitle('🤖 Danh sách lệnh Bot')
            .setDescription('Dưới đây là tất cả các lệnh có sẵn:')
            .setColor('#0099ff')
            .addFields(
                {
                    name: '👤 **Thông tin cá nhân**',
                    value: '`!profile` - Xem thông tin profile\n`!daily` - Nhận phần thưởng hàng ngày\n`!balance` - Xem số dư',
                    inline: false
                },
                {
                    name: '🎮 **Minigames**',
                    value: '`!rps <rock/paper/scissors>` - Kéo búa bao\n`!guess` - Đoán số\n`!trivia` - Câu hỏi vui\n`!slots` - Máy đánh bạc\n`!coinflip <heads/tails>` - Tung đồng xu\n`!mining` - Đào đá kiếm coins',
                    inline: false
                },
                {
                    name: '🛒 **Cửa hàng & Economy**',
                    value: '`!shop` - Xem cửa hàng\n`!buy <item_id>` - Mua vật phẩm\n`!inventory` - Xem kho đồ\n`!pickaxe [info/upgrade/repair]` - Quản lý cuốc đào',
                    inline: false
                },
                {
                    name: '📊 **Thống kê**',
                    value: '`!stats` - Xem thống kê game\n`!leaderboard` - Bảng xếp hạng',
                    inline: false
                },
                {
                    name: '🎯 **Khác**',
                    value: '`!help` - Hiển thị tin nhắn này',
                    inline: false
                }
            )
            .setFooter({ 
                text: 'Prefix: ! | Bot được tạo bởi GitHub Copilot',
                iconURL: client.user.displayAvatarURL()
            })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};