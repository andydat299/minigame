const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Database = require('../database/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('Xem kho đồ và cuốc của bạn'),
    
    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;

        await Database.createUser(userId, username);

        // Lấy thông tin cuốc
        const userPickaxe = await this.getUserPickaxe(userId);
        
        // Lấy items trong inventory
        const inventoryItems = await this.getUserInventory(userId);

        const embed = new EmbedBuilder()
            .setTitle(`🎒 Kho đồ của ${username}`)
            .setColor('#9932cc')
            .setThumbnail(interaction.user.displayAvatarURL());

        // Hiển thị cuốc
        if (userPickaxe) {
            const pickaxeData = this.getPickaxeData();
            const pickaxe = pickaxeData[userPickaxe.level];
            const durabilityPercent = Math.floor((userPickaxe.durability / userPickaxe.max_durability) * 100);
            
            // Tạo thanh độ bền
            const barLength = 10;
            const filledBars = Math.floor((durabilityPercent / 100) * barLength);
            const emptyBars = barLength - filledBars;
            const durabilityBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

            embed.addFields({
                name: '⛏️ Cuốc đào',
                value: `**${pickaxe.name}** (Level ${userPickaxe.level})\n${durabilityBar} ${userPickaxe.durability}/${userPickaxe.max_durability} (${durabilityPercent}%)\n⚡ Hiệu suất: x${pickaxe.efficiency}`,
                inline: false
            });
        } else {
            embed.addFields({
                name: '⛏️ Cuốc đào',
                value: 'Chưa có cuốc! Sử dụng `/mining` để nhận cuốc đầu tiên.',
                inline: false
            });
        }

        // Hiển thị items khác
        if (inventoryItems && inventoryItems.length > 0) {
            const itemList = inventoryItems.map(item => 
                `${item.emoji || '📦'} **${item.name}** x${item.quantity}`
            ).join('\n');

            embed.addFields({
                name: '🎁 Vật phẩm',
                value: itemList,
                inline: false
            });
        } else {
            embed.addFields({
                name: '🎁 Vật phẩm',
                value: 'Kho đồ trống! Mua vật phẩm tại `/shop`',
                inline: false
            });
        }

        embed.setFooter({ text: 'Sử dụng /pickaxe để quản lý cuốc | /shop để mua vật phẩm' });

        await interaction.reply({ embeds: [embed] });
    },

    // Helper functions
    async getUserPickaxe(userId) {
        return new Promise((resolve, reject) => {
            Database.db.get(
                'SELECT * FROM user_pickaxes WHERE user_id = ?',
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    },

    async getUserInventory(userId) {
        return new Promise((resolve, reject) => {
            Database.db.all(`
                SELECT ui.quantity, si.name, si.emoji 
                FROM user_inventory ui 
                JOIN shop_items si ON ui.item_id = si.id 
                WHERE ui.user_id = ?
            `, [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

    getPickaxeData() {
        return {
            1: { name: 'Cuốc Gỗ', durability: 50, efficiency: 1, price: 0 },
            2: { name: 'Cuốc Đá', durability: 80, efficiency: 1.2, price: 500 },
            3: { name: 'Cuốc Đồng', durability: 120, efficiency: 1.5, price: 1000 },
            4: { name: 'Cuốc Sắt', durability: 180, efficiency: 2, price: 2000 },
            5: { name: 'Cuốc Vàng', durability: 100, efficiency: 3, price: 3500 },
            6: { name: 'Cuốc Kim Cương', durability: 300, efficiency: 2.5, price: 5000 },
            7: { name: 'Cuốc Netherite', durability: 400, efficiency: 3.5, price: 8000 },
            8: { name: 'Cuốc Emerald', durability: 350, efficiency: 4, price: 12000 },
            9: { name: 'Cuốc Ruby', durability: 450, efficiency: 4.5, price: 18000 },
            10: { name: 'Cuốc Sapphire', durability: 500, efficiency: 5, price: 25000 },
            11: { name: 'Cuốc Obsidian', durability: 600, efficiency: 6, price: 35000 },
            12: { name: 'Cuốc Mythril', durability: 700, efficiency: 7, price: 50000 },
            13: { name: 'Cuốc Adamant', durability: 800, efficiency: 8, price: 70000 },
            14: { name: 'Cuốc Titanium', durability: 900, efficiency: 9, price: 100000 },
            15: { name: 'Cuốc Plasma', durability: 1000, efficiency: 10, price: 150000 },
            16: { name: 'Cuốc Quantum', durability: 1200, efficiency: 12, price: 220000 },
            17: { name: 'Cuốc Cosmic', durability: 1500, efficiency: 15, price: 320000 },
            18: { name: 'Cuốc Divine', durability: 2000, efficiency: 20, price: 500000 },
            19: { name: 'Cuốc Legendary', durability: 2500, efficiency: 25, price: 800000 },
            20: { name: 'Cuốc Eternal', durability: 3000, efficiency: 30, price: 1200000 }
        };
    }
};