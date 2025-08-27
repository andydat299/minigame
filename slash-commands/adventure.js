const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Database = require('../database/database');

// Định nghĩa các boss với thông tin chi tiết
const bosses = [
    {
        id: 1,
        name: 'Slime King',
        emoji: '👑',
        hp: 100,
        attack: 15,
        defense: 5,
        reward: { coins: 300, xp: 50 },
        rarity: 40
    },
    {
        id: 2,
        name: 'Fire Dragon',
        emoji: '🐲',
        hp: 200,
        attack: 25,
        defense: 10,
        reward: { coins: 600, xp: 100 },
        rarity: 25
    },
    {
        id: 3,
        name: 'Shadow Demon',
        emoji: '😈',
        hp: 150,
        attack: 30,
        defense: 8,
        reward: { coins: 500, xp: 80 },
        rarity: 20
    },
    {
        id: 4,
        name: 'Ice Giant',
        emoji: '🧊',
        hp: 300,
        attack: 20,
        defense: 15,
        reward: { coins: 800, xp: 120 },
        rarity: 10
    },
    {
        id: 5,
        name: 'Ancient Golem',
        emoji: '🗿',
        hp: 500,
        attack: 35,
        defense: 20,
        reward: { coins: 1500, xp: 200 },
        rarity: 5
    }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('adventure')
        .setDescription('Tham gia phiêu lưu chiến đấu với boss')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Hành động trong phiêu lưu')
                .setRequired(false)
                .addChoices(
                    { name: '⚔️ Tìm Boss', value: 'fight' },
                    { name: '🛡️ Xem Equipment', value: 'gear' },
                    { name: '💊 Hồi Máu', value: 'heal' }
                )),

    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;
        const action = interaction.options.getString('action') || 'fight';

        await Database.createUser(userId, username);

        if (action === 'gear') {
            await this.showGear(interaction, userId);
        } else if (action === 'heal') {
            await this.healPlayer(interaction, userId);
        } else {
            await this.startBossFight(interaction, userId);
        }
    },

    async startBossFight(interaction, userId) {
        // Lấy thông tin player
        const player = await this.getPlayerStats(userId);
        
        // Random boss
        const boss = this.getRandomBoss();
        const playerHp = player.maxHp;
        const bossHp = boss.hp;

        const embed = new EmbedBuilder()
            .setTitle('⚔️ Phiêu lưu Boss Fight!')
            .setDescription(`Bạn gặp **${boss.emoji} ${boss.name}**!`)
            .addFields(
                { name: '👤 Player Stats', value: `❤️ HP: ${playerHp}/${player.maxHp}\n⚔️ ATK: ${player.attack}\n🛡️ DEF: ${player.defense}`, inline: true },
                { name: `${boss.emoji} Boss Stats`, value: `❤️ HP: ${bossHp}/${boss.hp}\n⚔️ ATK: ${boss.attack}\n🛡️ DEF: ${boss.defense}`, inline: true },
                { name: '💰 Phần thưởng', value: `${boss.reward.coins} coins\n${boss.reward.xp} XP`, inline: true }
            )
            .setColor('#ff6b35');

        const attackButton = new ButtonBuilder()
            .setCustomId('boss_attack')
            .setLabel('⚔️ Tấn công')
            .setStyle(ButtonStyle.Danger);

        const defendButton = new ButtonBuilder()
            .setCustomId('boss_defend')
            .setLabel('🛡️ Phòng thủ')
            .setStyle(ButtonStyle.Secondary);

        const healButton = new ButtonBuilder()
            .setCustomId('boss_heal')
            .setLabel('💊 Hồi máu')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(attackButton, defendButton, healButton);

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });

        // Lưu trạng thái battle
        await this.saveBattleState(userId, {
            bossId: boss.id,
            playerHp: playerHp,
            bossHp: bossHp,
            turn: 1
        });

        // Collector cho battle
        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.user.id === userId,
            time: 300000 // 5 phút
        });

        collector.on('collect', async (buttonInteraction) => {
            await this.handleBattleAction(buttonInteraction, userId);
        });
    },

    async handleBattleAction(interaction, userId) {
        const action = interaction.customId.split('_')[1];
        const battleState = await this.getBattleState(userId);
        
        if (!battleState) {
            return interaction.reply({ content: '❌ Không tìm thấy trận chiến!', ephemeral: true });
        }

        const boss = bosses.find(b => b.id === battleState.bossId);
        const player = await this.getPlayerStats(userId);

        let playerDamage = 0;
        let bossDamage = 0;
        let playerHeal = 0;
        let actionText = '';

        // Xử lý hành động của player
        if (action === 'attack') {
            playerDamage = Math.max(1, player.attack - boss.defense + Math.floor(Math.random() * 10) - 5);
            actionText = `⚔️ Bạn tấn công gây ${playerDamage} damage!`;
        } else if (action === 'defend') {
            playerDamage = Math.max(1, Math.floor(player.attack * 0.7) - boss.defense);
            actionText = `🛡️ Bạn phòng thủ và phản công gây ${playerDamage} damage!`;
        } else if (action === 'heal') {
            playerHeal = Math.floor(player.maxHp * 0.3);
            actionText = `💊 Bạn hồi ${playerHeal} HP!`;
        }

        // Cập nhật HP boss
        battleState.bossHp = Math.max(0, battleState.bossHp - playerDamage);
        
        // Cập nhật HP player (heal)
        battleState.playerHp = Math.min(player.maxHp, battleState.playerHp + playerHeal);

        // Boss tấn công (nếu còn sống và player không phòng thủ hoàn toàn)
        if (battleState.bossHp > 0) {
            const damageReduction = action === 'defend' ? 0.5 : 1;
            bossDamage = Math.max(1, Math.floor((boss.attack - player.defense) * damageReduction));
            battleState.playerHp = Math.max(0, battleState.playerHp - bossDamage);
        }

        battleState.turn++;

        // Kiểm tra kết thúc trận đấu
        if (battleState.bossHp <= 0) {
            // Player thắng
            await this.handleVictory(interaction, userId, boss);
            await this.deleteBattleState(userId);
            return;
        } else if (battleState.playerHp <= 0) {
            // Player thua
            await this.handleDefeat(interaction, userId, boss);
            await this.deleteBattleState(userId);
            return;
        }

        // Cập nhật trạng thái battle
        await this.saveBattleState(userId, battleState);

        // Tạo embed cập nhật
        const embed = new EmbedBuilder()
            .setTitle(`⚔️ Battle vs ${boss.emoji} ${boss.name} - Turn ${battleState.turn}`)
            .setDescription(`${actionText}\n${battleState.bossHp > 0 ? `${boss.emoji} ${boss.name} tấn công gây ${bossDamage} damage!` : ''}`)
            .addFields(
                { name: '👤 Your HP', value: `❤️ ${battleState.playerHp}/${player.maxHp}`, inline: true },
                { name: `${boss.emoji} Boss HP`, value: `❤️ ${battleState.bossHp}/${boss.hp}`, inline: true }
            )
            .setColor(battleState.playerHp < player.maxHp * 0.3 ? '#ff0000' : '#ffaa00');

        const attackButton = new ButtonBuilder()
            .setCustomId('boss_attack')
            .setLabel('⚔️ Tấn công')
            .setStyle(ButtonStyle.Danger);

        const defendButton = new ButtonBuilder()
            .setCustomId('boss_defend')
            .setLabel('🛡️ Phòng thủ')
            .setStyle(ButtonStyle.Secondary);

        const healButton = new ButtonBuilder()
            .setCustomId('boss_heal')
            .setLabel('💊 Hồi máu')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(attackButton, defendButton, healButton);

        await interaction.update({
            embeds: [embed],
            components: [row]
        });
    },

    async handleVictory(interaction, userId, boss) {
        await Database.updateUserBalance(userId, boss.reward.coins);
        await Database.updateUserXP(userId, boss.reward.xp);
        await Database.updateGameStats(userId, 'adventure', 'win');

        const embed = new EmbedBuilder()
            .setTitle('🎉 Chiến thắng!')
            .setDescription(`Bạn đã đánh bại **${boss.emoji} ${boss.name}**!`)
            .addFields(
                { name: '💰 Phần thưởng', value: `${boss.reward.coins.toLocaleString()} coins`, inline: true },
                { name: '⭐ XP', value: `+${boss.reward.xp} XP`, inline: true }
            )
            .setColor('#00ff00')
            .setFooter({ text: 'Sử dụng /adventure để tiếp tục phiêu lưu!' });

        await interaction.update({
            embeds: [embed],
            components: []
        });
    },

    async handleDefeat(interaction, userId, boss) {
        await Database.updateGameStats(userId, 'adventure', 'lose');

        const embed = new EmbedBuilder()
            .setTitle('💀 Thất bại!')
            .setDescription(`Bạn đã bị **${boss.emoji} ${boss.name}** đánh bại!`)
            .setColor('#ff0000')
            .setFooter({ text: 'Hồi máu và thử lại với /adventure heal!' });

        await interaction.update({
            embeds: [embed],
            components: []
        });
    },

    // Helper functions
    getRandomBoss() {
        const rand = Math.random() * 100;
        let cumulative = 0;
        
        for (const boss of bosses) {
            cumulative += boss.rarity;
            if (rand <= cumulative) {
                return boss;
            }
        }
        return bosses[0];
    },

    async getPlayerStats(userId) {
        const user = await Database.getUser(userId);
        const level = Math.floor(user.xp / 100) + 1;
        
        return {
            maxHp: 100 + (level * 10),
            attack: 20 + (level * 2),
            defense: 10 + level
        };
    },

    async saveBattleState(userId, state) {
        return new Promise((resolve, reject) => {
            Database.db.run(`
                INSERT OR REPLACE INTO battle_states (user_id, boss_id, player_hp, boss_hp, turn, created_at)
                VALUES (?, ?, ?, ?, ?, datetime('now'))
            `, [userId, state.bossId, state.playerHp, state.bossHp, state.turn], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    },

    async getBattleState(userId) {
        return new Promise((resolve, reject) => {
            Database.db.get(
                'SELECT * FROM battle_states WHERE user_id = ?',
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    },

    async deleteBattleState(userId) {
        return new Promise((resolve, reject) => {
            Database.db.run(
                'DELETE FROM battle_states WHERE user_id = ?',
                [userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    },

    async showGear(interaction, userId) {
        const player = await this.getPlayerStats(userId);
        const user = await Database.getUser(userId);
        const level = Math.floor(user.xp / 100) + 1;

        const embed = new EmbedBuilder()
            .setTitle('🛡️ Equipment & Stats')
            .setDescription(`Level ${level} Adventurer`)
            .addFields(
                { name: '❤️ Health', value: `${player.maxHp} HP`, inline: true },
                { name: '⚔️ Attack', value: `${player.attack} ATK`, inline: true },
                { name: '🛡️ Defense', value: `${player.defense} DEF`, inline: true }
            )
            .setColor('#9932cc')
            .setFooter({ text: 'Stats tăng theo level! Chơi game để lên level.' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },

    async healPlayer(interaction, userId) {
        const user = await Database.getUser(userId);
        const healCost = 100;

        if (user.balance < healCost) {
            return interaction.reply({ 
                content: `❌ Bạn cần ${healCost} coins để hồi máu!`, 
                ephemeral: true 
            });
        }

        await Database.updateUserBalance(userId, -healCost);

        const embed = new EmbedBuilder()
            .setTitle('💊 Hồi máu thành công!')
            .setDescription('Bạn đã hồi đầy máu và sẵn sàng chiến đấu!')
            .addFields(
                { name: '💰 Chi phí', value: `${healCost} coins`, inline: true },
                { name: '❤️ Trạng thái', value: 'Máu đầy 100%', inline: true }
            )
            .setColor('#00ff00');

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};