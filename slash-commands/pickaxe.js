const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Database = require('../database/database');

const pickaxeData = {
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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pickaxe')
        .setDescription('Quản lý cuốc đào')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Hành động với cuốc')
                .setRequired(false)
                .addChoices(
                    { name: '📋 Xem thông tin', value: 'info' },
                    { name: '🔧 Nâng cấp', value: 'upgrade' },
                    { name: '🔨 Sửa chữa', value: 'repair' }
                ))
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('Level cuốc để nâng cấp (1-20)')
                .setMinValue(1)
                .setMaxValue(20)
                .setRequired(false)),

    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;
        const action = interaction.options.getString('action') || 'info';
        const level = interaction.options.getInteger('level');

        await Database.createUser(userId, username);

        if (action === 'upgrade') {
            if (level) {
                await this.upgradePickaxe(interaction, userId, level);
            } else {
                await this.showUpgradeInfo(interaction, userId);
            }
        } else if (action === 'repair') {
            await this.repairPickaxe(interaction, userId);
        } else {
            await this.showPickaxeInfo(interaction, userId);
        }
    },

    async showPickaxeInfo(interaction, userId) {
        const userPickaxe = await this.getUserPickaxe(userId);
        
        if (!userPickaxe) {
            return interaction.reply({ 
                content: '❌ Bạn chưa có cuốc! Sử dụng `/mining` để nhận cuốc đầu tiên.',
                ephemeral: true 
            });
        }

        const pickaxe = pickaxeData[userPickaxe.level];
        const durabilityPercent = Math.floor((userPickaxe.durability / userPickaxe.max_durability) * 100);
        
        // Tạo thanh độ bền
        const barLength = 10;
        const filledBars = Math.floor((durabilityPercent / 100) * barLength);
        const emptyBars = barLength - filledBars;
        const durabilityBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

        const embed = new EmbedBuilder()
            .setTitle('⛏️ Thông tin cuốc của bạn')
            .setDescription(`**${pickaxe.name}** (Level ${userPickaxe.level})`)
            .addFields(
                { 
                    name: '🔧 Độ bền', 
                    value: `${durabilityBar} ${userPickaxe.durability}/${userPickaxe.max_durability} (${durabilityPercent}%)`, 
                    inline: false 
                },
                { name: '⚡ Hiệu suất', value: `x${pickaxe.efficiency}`, inline: true },
                { name: '💰 Giá trị', value: `${pickaxe.price.toLocaleString()} coins`, inline: true },
                { 
                    name: '🔨 Chi phí sửa chữa', 
                    value: `${Math.floor(pickaxe.price * 0.3).toLocaleString()} coins`, 
                    inline: true 
                }
            )
            .setColor(durabilityPercent > 50 ? '#00ff00' : durabilityPercent > 20 ? '#ffaa00' : '#ff0000')
            .setFooter({ text: 'Sử dụng /pickaxe upgrade để nâng cấp cuốc' });

        await interaction.reply({ embeds: [embed] });
    },

    async showUpgradeInfo(interaction, userId) {
        const userPickaxe = await this.getUserPickaxe(userId);
        const currentLevel = userPickaxe ? userPickaxe.level : 0;

        const embed = new EmbedBuilder()
            .setTitle('🔧 Nâng cấp cuốc')
            .setDescription('Nâng cấp cuốc để tăng hiệu suất đào!')
            .setColor('#ff6b35');

        if (currentLevel >= 20) {
            embed.setDescription('🎉 Cuốc của bạn đã đạt level tối đa!');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Hiển thị cuốc hiện tại và level tiếp theo
        if (currentLevel > 0) {
            const currentPickaxe = pickaxeData[currentLevel];
            embed.addFields({
                name: `⚒️ Cuốc hiện tại - Level ${currentLevel}`,
                value: `${currentPickaxe.name}\n⚡ Hiệu suất: x${currentPickaxe.efficiency}\n🔧 Độ bền: ${currentPickaxe.durability}`,
                inline: false
            });
        }

        // Hiển thị upgrade tiếp theo
        const nextLevel = currentLevel + 1;
        const nextPickaxe = pickaxeData[nextLevel];
        const upgradeCost = Math.floor(nextPickaxe.price * 0.7);

        embed.addFields({
            name: `🆙 Nâng cấp lên Level ${nextLevel}`,
            value: `**${nextPickaxe.name}**\n⚡ Hiệu suất: x${nextPickaxe.efficiency} (+${(nextPickaxe.efficiency - (pickaxeData[currentLevel]?.efficiency || 0)).toFixed(1)})\n🔧 Độ bền: ${nextPickaxe.durability} (+${nextPickaxe.durability - (pickaxeData[currentLevel]?.durability || 0)})\n💰 **Chi phí nâng cấp: ${upgradeCost.toLocaleString()} coins**`,
            inline: false
        });

        embed.setFooter({ text: `Sử dụng /pickaxe upgrade level:${nextLevel} để nâng cấp` });

        await interaction.reply({ embeds: [embed] });
    },

    async upgradePickaxe(interaction, userId, level) {
        const user = await Database.getUser(userId);
        const userPickaxe = await this.getUserPickaxe(userId);
        
        if (!userPickaxe) {
            if (level !== 1) {
                return interaction.reply({ content: '❌ Bạn cần có cuốc cơ bản trước! Sử dụng `/mining` để nhận cuốc đầu tiên.', ephemeral: true });
            }
            await this.createUserPickaxe(userId, 1);
            return interaction.reply({ content: '🎉 Bạn đã nhận được cuốc gỗ miễn phí! Sử dụng `/mining` để bắt đầu đào.', ephemeral: true });
        }

        const currentLevel = userPickaxe.level;
        
        if (level !== currentLevel + 1) {
            return interaction.reply({ content: `❌ Bạn chỉ có thể nâng cấp lên level tiếp theo (Level ${currentLevel + 1})!`, ephemeral: true });
        }

        const nextPickaxe = pickaxeData[level];
        const upgradeCost = Math.floor(nextPickaxe.price * 0.7);

        if (user.balance < upgradeCost) {
            return interaction.reply({ content: `❌ Bạn cần ${upgradeCost.toLocaleString()} coins để nâng cấp lên ${nextPickaxe.name}!`, ephemeral: true });
        }

        // Tính toán độ bền sau nâng cấp
        const currentDurabilityPercent = userPickaxe.durability / userPickaxe.max_durability;
        const newDurability = Math.floor(nextPickaxe.durability * currentDurabilityPercent);

        // Cập nhật database
        await Database.updateUserBalance(userId, -upgradeCost);
        await this.upgradeUserPickaxe(userId, level, newDurability);

        const embed = new EmbedBuilder()
            .setTitle('🔧 Nâng cấp cuốc thành công!')
            .setDescription(`Cuốc đã được nâng cấp lên **${nextPickaxe.name}** (Level ${level})!`)
            .addFields(
                { name: '⚡ Hiệu suất mới', value: `x${nextPickaxe.efficiency}`, inline: true },
                { name: '🔧 Độ bền tối đa', value: `${nextPickaxe.durability}`, inline: true },
                { name: '🔧 Độ bền hiện tại', value: `${newDurability}/${nextPickaxe.durability}`, inline: true },
                { name: '💰 Chi phí nâng cấp', value: `${upgradeCost.toLocaleString()} coins`, inline: true }
            )
            .setColor('#00ff00')
            .setFooter({ text: 'Sử dụng /mining để test cuốc mới!' });

        await interaction.reply({ embeds: [embed] });
    },

    async repairPickaxe(interaction, userId) {
        const userPickaxe = await this.getUserPickaxe(userId);
        
        if (!userPickaxe) {
            return interaction.reply({ content: '❌ Bạn chưa có cuốc để sửa chữa!', ephemeral: true });
        }

        if (userPickaxe.durability >= userPickaxe.max_durability) {
            return interaction.reply({ content: '❌ Cuốc của bạn vẫn còn nguyên vẹn!', ephemeral: true });
        }

        const pickaxe = pickaxeData[userPickaxe.level];
        const repairCost = Math.floor(pickaxe.price * 0.3);
        const user = await Database.getUser(userId);

        if (user.balance < repairCost) {
            return interaction.reply({ content: `❌ Bạn cần ${repairCost.toLocaleString()} coins để sửa chữa cuốc!`, ephemeral: true });
        }

        // Sửa chữa
        await Database.updateUserBalance(userId, -repairCost);
        await this.repairUserPickaxe(userId);

        const embed = new EmbedBuilder()
            .setTitle('🔨 Sửa chữa thành công!')
            .setDescription(`**${pickaxe.name}** đã được sửa chữa hoàn toàn!`)
            .addFields(
                { name: '🔧 Độ bền', value: `${userPickaxe.max_durability}/${userPickaxe.max_durability}`, inline: true },
                { name: '💰 Chi phí', value: `${repairCost.toLocaleString()} coins`, inline: true }
            )
            .setColor('#00ff00');

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

    async createUserPickaxe(userId, level) {
        const pickaxe = pickaxeData[level];
        return new Promise((resolve, reject) => {
            Database.db.run(
                'INSERT INTO user_pickaxes (user_id, level, durability, max_durability) VALUES (?, ?, ?, ?)',
                [userId, level, pickaxe.durability, pickaxe.durability],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    },

    async upgradeUserPickaxe(userId, level, newDurability) {
        const pickaxe = pickaxeData[level];
        return new Promise((resolve, reject) => {
            Database.db.run(
                'UPDATE user_pickaxes SET level = ?, durability = ?, max_durability = ? WHERE user_id = ?',
                [level, newDurability, pickaxe.durability, userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    },

    async repairUserPickaxe(userId) {
        return new Promise((resolve, reject) => {
            Database.db.run(
                'UPDATE user_pickaxes SET durability = max_durability WHERE user_id = ?',
                [userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }
};