const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Database = require('../database/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Mua vật phẩm từ cửa hàng')
        .addIntegerOption(option =>
            option.setName('item')
                .setDescription('ID của vật phẩm muốn mua')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('quantity')
                .setDescription('Số lượng muốn mua')
                .setMinValue(1)
                .setRequired(false)),
    
    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;
        const itemId = interaction.options.getInteger('item');
        const quantity = interaction.options.getInteger('quantity') || 1;

        // Tạo user nếu chưa có
        await Database.createUser(userId, username);
        const user = await Database.getUser(userId);

        try {
            // Lấy thông tin item
            const item = await this.getShopItem(itemId);
            
            if (!item) {
                return interaction.reply({ 
                    content: '❌ Không tìm thấy vật phẩm này trong cửa hàng!', 
                    ephemeral: true 
                });
            }

            const totalCost = item.price * quantity;

            if (user.balance < totalCost) {
                return interaction.reply({ 
                    content: `❌ Bạn cần ${totalCost.toLocaleString()} coins để mua ${quantity}x ${item.name}!`, 
                    ephemeral: true 
                });
            }

            // Cập nhật balance
            await Database.updateUserBalance(userId, -totalCost);
            
            // Thêm vào inventory
            await this.addToInventory(userId, itemId, quantity);

            const embed = new EmbedBuilder()
                .setTitle('🎉 Mua hàng thành công!')
                .setDescription(`Bạn đã mua **${quantity}x ${item.emoji} ${item.name}**`)
                .addFields(
                    { name: '💰 Tổng chi phí', value: `${totalCost.toLocaleString()} coins`, inline: true },
                    { name: '🏦 Số dư còn lại', value: `${(user.balance - totalCost).toLocaleString()} coins`, inline: true },
                    { name: '📦 Vật phẩm', value: item.description, inline: false }
                )
                .setColor('#00ff00')
                .setFooter({ text: 'Sử dụng /inventory để xem kho đồ' });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Buy error:', error);
            await interaction.reply({ 
                content: '❌ Có lỗi xảy ra khi mua vật phẩm!', 
                ephemeral: true 
            });
        }
    },

    async getShopItem(itemId) {
        return new Promise((resolve, reject) => {
            Database.db.get(
                'SELECT * FROM shop_items WHERE id = ?',
                [itemId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    },

    async addToInventory(userId, itemId, quantity) {
        return new Promise((resolve, reject) => {
            // Kiểm tra xem user đã có item này chưa
            Database.db.get(
                'SELECT * FROM user_inventory WHERE user_id = ? AND item_id = ?',
                [userId, itemId],
                (err, existingItem) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (existingItem) {
                        // Cập nhật số lượng
                        Database.db.run(
                            'UPDATE user_inventory SET quantity = quantity + ? WHERE user_id = ? AND item_id = ?',
                            [quantity, userId, itemId],
                            function(updateErr) {
                                if (updateErr) reject(updateErr);
                                else resolve(this.changes);
                            }
                        );
                    } else {
                        // Thêm item mới
                        Database.db.run(
                            'INSERT INTO user_inventory (user_id, item_id, quantity) VALUES (?, ?, ?)',
                            [userId, itemId, quantity],
                            function(insertErr) {
                                if (insertErr) reject(insertErr);
                                else resolve(this.lastID);
                            }
                        );
                    }
                }
            );
        });
    }
};