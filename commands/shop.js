const { EmbedBuilder } = require('discord.js');
const Database = require('../database/database');

module.exports = {
    name: 'shop',
    description: 'Xem cửa hàng vật phẩm',
    async execute(message, args, client) {
        try {
            const items = await Database.getShopItems();

            if (!items || items.length === 0) {
                return message.reply('❌ Cửa hàng hiện tại không có vật phẩm nào!');
            }

            const embed = new EmbedBuilder()
                .setTitle('🛒 Cửa hàng vật phẩm')
                .setDescription('Sử dụng `!buy <id>` để mua vật phẩm')
                .setColor('#ff6b35');

            // Nhóm vật phẩm theo category
            const categories = {};
            items.forEach(item => {
                if (!categories[item.category]) {
                    categories[item.category] = [];
                }
                categories[item.category].push(item);
            });

            // Thêm field cho từng category
            Object.keys(categories).forEach(category => {
                const categoryItems = categories[category];
                const itemList = categoryItems.map(item => 
                    `**${item.id}.** ${item.emoji} **${item.name}** - ${item.price.toLocaleString()} coins\n*${item.description}*`
                ).join('\n\n');

                const categoryName = {
                    'boost': '⚡ Boost Items',
                    'treasure': '💎 Treasures',
                    'utility': '🔧 Utilities',
                    'trophy': '🏆 Trophies'
                };

                embed.addFields({
                    name: categoryName[category] || category,
                    value: itemList,
                    inline: false
                });
            });

            embed.setFooter({ text: 'Sử dụng !inventory để xem kho đồ của bạn' });

            message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Shop error:', error);
            message.reply('❌ Có lỗi xảy ra khi tải cửa hàng!');
        }
    }
};