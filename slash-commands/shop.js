const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Database = require('../database/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Xem cửa hàng vật phẩm')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Danh mục sản phẩm')
                .setRequired(false)
                .addChoices(
                    { name: '⚡ Boost Items', value: 'boost' },
                    { name: '💎 Treasures', value: 'treasure' },
                    { name: '🔧 Utilities', value: 'utility' },
                    { name: '🏆 Trophies', value: 'trophy' }
                )),
    
    async execute(interaction) {
        const category = interaction.options.getString('category');
        
        try {
            const items = await Database.getShopItems();

            if (!items || items.length === 0) {
                return interaction.reply({ 
                    content: '❌ Cửa hàng hiện tại không có vật phẩm nào!', 
                    ephemeral: true 
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🛒 Cửa hàng vật phẩm')
                .setDescription('Sử dụng `/buy item:<id>` để mua vật phẩm')
                .setColor('#ff6b35');

            // Lọc theo category nếu có
            const filteredItems = category ? items.filter(item => item.category === category) : items;

            if (filteredItems.length === 0) {
                return interaction.reply({ 
                    content: `❌ Không có vật phẩm nào trong danh mục ${category}!`, 
                    ephemeral: true 
                });
            }

            // Nhóm vật phẩm theo category
            const categories = {};
            filteredItems.forEach(item => {
                if (!categories[item.category]) {
                    categories[item.category] = [];
                }
                categories[item.category].push(item);
            });

            // Thêm field cho từng category
            Object.keys(categories).forEach(cat => {
                const categoryItems = categories[cat];
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
                    name: categoryName[cat] || cat,
                    value: itemList,
                    inline: false
                });
            });

            embed.setFooter({ text: 'Sử dụng /inventory để xem kho đồ của bạn' });

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Shop error:', error);
            await interaction.reply({ 
                content: '❌ Có lỗi xảy ra khi tải cửa hàng!', 
                ephemeral: true 
            });
        }
    }
};