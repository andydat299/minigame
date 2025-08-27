const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Database = require('../database/database');

// Thông tin cuốc theo level
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

// Loại đá và phần thưởng
const rocks = [
    { name: 'Đá Thường', emoji: '🪨', reward: 10, rarity: 70 },
    { name: 'Đá Quý', emoji: '💎', reward: 50, rarity: 20 },
    { name: 'Vàng', emoji: '🏆', reward: 100, rarity: 8 },
    { name: 'Kim Cương', emoji: '💠', reward: 200, rarity: 2 }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mining')
        .setDescription('Đào đá để kiếm coins - yêu cầu ấn nút'),
    
    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;

        // Tạo user nếu chưa có
        await Database.createUser(userId, username);
        
        // Lấy thông tin cuốc của user
        let userPickaxe = await this.getUserPickaxe(userId);
        if (!userPickaxe) {
            // Tạo cuốc level 1 mặc định
            await this.createUserPickaxe(userId, 1);
            userPickaxe = await this.getUserPickaxe(userId);
        }

        const pickaxe = pickaxeData[userPickaxe.level];
        
        // Kiểm tra độ bền cuốc
        if (userPickaxe.durability <= 0) {
            const repairCost = Math.floor(pickaxe.price * 0.3);
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('⚠️ Cuốc đã hỏng!')
                    .setDescription(`${pickaxe.name} của bạn đã hết độ bền!\n\n💰 Chi phí sửa chữa: **${repairCost.toLocaleString()} coins**\n\nSử dụng \`/pickaxe repair\` để sửa cuốc.`)
                    .setColor('#ff0000')],
                ephemeral: true
            });
        }

        // Tạo số lần đập random
        const requiredHits = Math.floor(Math.random() * 10) + 1;
        let currentHits = 0;
        
        // Chọn loại đá random
        const randomRock = this.getRandomRock();
        
        const embed = new EmbedBuilder()
            .setTitle('⛏️ Đào Đá!')
            .setDescription(`Bạn tìm thấy **${randomRock.emoji} ${randomRock.name}**!\n\nẤn nút **${requiredHits} lần** để đập vỡ đá này!`)
            .addFields(
                { name: '⚒️ Cuốc hiện tại', value: `${pickaxe.name} (Độ bền: ${userPickaxe.durability}/${pickaxe.durability})`, inline: true },
                { name: '🎯 Tiến độ', value: `${currentHits}/${requiredHits} lần đập`, inline: true },
                { name: '💎 Phần thưởng dự kiến', value: `${Math.floor(randomRock.reward * pickaxe.efficiency)} coins`, inline: true }
            )
            .setColor('#8B4513');

        const button = new ButtonBuilder()
            .setCustomId('mine_hit')
            .setLabel('⛏️ Đập!')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });

        // Collector cho button clicks
        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.user.id === userId && i.customId === 'mine_hit',
            time: 30000
        });

        collector.on('collect', async (buttonInteraction) => {
            currentHits++;
            
            // Cập nhật embed
            const updatedEmbed = new EmbedBuilder()
                .setTitle('⛏️ Đào Đá!')
                .setDescription(`Bạn đang đập **${randomRock.emoji} ${randomRock.name}**!`)
                .addFields(
                    { name: '⚒️ Cuốc hiện tại', value: `${pickaxe.name} (Độ bền: ${userPickaxe.durability}/${pickaxe.durability})`, inline: true },
                    { name: '🎯 Tiến độ', value: `${currentHits}/${requiredHits} lần đập`, inline: true },
                    { name: '💎 Phần thưởng dự kiến', value: `${Math.floor(randomRock.reward * pickaxe.efficiency)} coins`, inline: true }
                )
                .setColor('#FFA500');

            if (currentHits >= requiredHits) {
                // Hoàn thành đào đá
                const finalReward = Math.floor(randomRock.reward * pickaxe.efficiency);
                const xpGain = Math.floor(finalReward / 10);
                
                // Cập nhật database
                await Database.updateUserBalance(userId, finalReward);
                await Database.updateUserXP(userId, xpGain);
                await Database.updateGameStats(userId, 'mining', 'win');
                
                // Giảm độ bền cuốc với random damage
                const randomDamage = Math.floor(Math.random() * 3) + 1;
                await this.updatePickaxeDurability(userId, -randomDamage);
                const newDurability = Math.max(0, userPickaxe.durability - randomDamage);
                
                const successEmbed = new EmbedBuilder()
                    .setTitle('🎉 Đào thành công!')
                    .setDescription(`Bạn đã đập vỡ **${randomRock.emoji} ${randomRock.name}**!`)
                    .addFields(
                        { name: '💰 Phần thưởng', value: `${finalReward.toLocaleString()} coins`, inline: true },
                        { name: '⭐ XP', value: `+${xpGain} XP`, inline: true },
                        { name: '⚒️ Độ hỏng cuốc', value: `-${randomDamage} độ bền`, inline: true },
                        { name: '🔧 Độ bền còn lại', value: `${newDurability}/${pickaxe.durability}`, inline: true }
                    )
                    .setColor('#00ff00')
                    .setFooter({ text: 'Sử dụng /mining để tiếp tục đào!' });

                await buttonInteraction.update({
                    embeds: [successEmbed],
                    components: []
                });
                
                collector.stop();
            } else {
                await buttonInteraction.update({
                    embeds: [updatedEmbed],
                    components: [row]
                });
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time' && currentHits < requiredHits) {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏰ Hết thời gian!')
                    .setDescription('Bạn đã hết thời gian để đập đá!')
                    .setColor('#ff0000')
                    .setFooter({ text: 'Thử lại với /mining' });

                await interaction.editReply({
                    embeds: [timeoutEmbed],
                    components: []
                });
            }
        });
    },

    // Helper functions
    getRandomRock() {
        const rand = Math.random() * 100;
        let cumulative = 0;
        
        for (const rock of rocks) {
            cumulative += rock.rarity;
            if (rand <= cumulative) {
                return rock;
            }
        }
        return rocks[0]; // fallback
    },

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

    async updatePickaxeDurability(userId, change) {
        return new Promise((resolve, reject) => {
            Database.db.run(
                'UPDATE user_pickaxes SET durability = MAX(0, durability + ?) WHERE user_id = ?',
                [change, userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }
};