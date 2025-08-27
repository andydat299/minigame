const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Database = require('../database/database');

// Hệ thống Tài Xỉu tự động với thời gian realtime
class SicBoGame {
    constructor() {
        this.sessions = new Map(); // channelId -> gameSession
        this.roundDuration = 30000; // 30 giây mỗi phiên
        this.history = new Map(); // channelId -> last 10 results
        this.timers = new Map(); // channelId -> timer
    }

    startAutoGame(channelId) {
        if (this.sessions.has(channelId)) return null;

        const session = {
            roundNumber: 1,
            bets: new Map(), // userId -> {type, amount}
            isActive: true,
            message: null,
            startTime: Date.now()
        };

        this.sessions.set(channelId, session);
        return this.runRound(channelId);
    }

    runRound(channelId) {
        const session = this.sessions.get(channelId);
        if (!session || !session.isActive) return null;

        // Reset bets cho phiên mới
        session.bets.clear();
        session.startTime = Date.now();
        
        // Tính thời gian kết thúc
        const endTime = Math.floor((session.startTime + this.roundDuration) / 1000);

        // Tạo embed betting phase với countdown
        const bettingEmbed = new EmbedBuilder()
            .setTitle(`🎲 Tài Xỉu - Phiên ${session.roundNumber}`)
            .setDescription(`**⏰ Đặt cược ngay - Kết thúc <t:${endTime}:R>**\n\n💰 Cược của bạn sẽ được xử lý tự động!`)
            .addFields(
                { name: '📊 Cách chơi', value: '🟢 **TÀI** (11-17 điểm)\n🔴 **XỈU** (4-10 điểm)\n💎 **HÒA** (3 hoặc 18 điểm)', inline: true },
                { name: '💰 Tỷ lệ thắng', value: 'Tài/Xỉu: x1.95\nHòa: x14.0', inline: true },
                { name: '📈 Thống kê phiên', value: `👥 0 người\n💸 0 coins`, inline: true }
            )
            .setColor('#ffaa00')
            .setTimestamp()
            .setFooter({ text: `Phiên ${session.roundNumber} | Auto game - Kết thúc lúc` });

        return { embed: bettingEmbed, session, endTime };
    }

    placeBet(channelId, userId, betType, amount) {
        const session = this.sessions.get(channelId);
        if (!session) return { success: false, message: 'Không có phiên tài xỉu nào đang diễn ra!' };

        // Kiểm tra thời gian còn lại
        const timeLeft = (session.startTime + this.roundDuration) - Date.now();
        if (timeLeft <= 0) {
            return { success: false, message: 'Phiên đã kết thúc, chờ phiên mới!' };
        }

        session.bets.set(userId, { type: betType, amount });
        return { success: true, timeLeft };
    }

    updateBettingDisplay(channelId) {
        const session = this.sessions.get(channelId);
        if (!session) return null;

        const bettingCount = session.bets.size;
        const totalBetAmount = Array.from(session.bets.values()).reduce((sum, bet) => sum + bet.amount, 0);
        const endTime = Math.floor((session.startTime + this.roundDuration) / 1000);

        const updatedEmbed = new EmbedBuilder()
            .setTitle(`🎲 Tài Xỉu - Phiên ${session.roundNumber}`)
            .setDescription(`**⏰ Đặt cược ngay - Kết thúc <t:${endTime}:R>**\n\n💰 Cược của bạn sẽ được xử lý tự động!`)
            .addFields(
                { name: '📊 Cách chơi', value: '🟢 **TÀI** (11-17 điểm)\n🔴 **XỈU** (4-10 điểm)\n💎 **HÒA** (3 hoặc 18 điểm)', inline: true },
                { name: '💰 Tỷ lệ thắng', value: 'Tài/Xỉu: x1.95\nHòa: x14.0', inline: true },
                { name: '📈 Thống kê phiên', value: `👥 ${bettingCount} người\n💸 ${totalBetAmount.toLocaleString()} coins`, inline: true }
            )
            .setColor('#ffaa00')
            .setTimestamp()
            .setFooter({ text: `Phiên ${session.roundNumber} | Live betting` });

        return updatedEmbed;
    }

    async finishRound(channelId) {
        const session = this.sessions.get(channelId);
        if (!session) return null;

        // Roll 3 xúc xắc
        const dice1 = Math.floor(Math.random() * 6) + 1;
        const dice2 = Math.floor(Math.random() * 6) + 1;
        const dice3 = Math.floor(Math.random() * 6) + 1;
        const total = dice1 + dice2 + dice3;

        // Xác định kết quả
        let result;
        let resultEmoji;
        if (total >= 11 && total <= 17) {
            result = 'tai';
            resultEmoji = '🟢';
        } else if (total >= 4 && total <= 10) {
            result = 'xiu';
            resultEmoji = '🔴';
        } else {
            result = 'hoa';
            resultEmoji = '💎';
        }

        // Cập nhật lịch sử
        if (!this.history.has(channelId)) {
            this.history.set(channelId, []);
        }
        const history = this.history.get(channelId);
        history.unshift({ round: session.roundNumber, result, total, dice: [dice1, dice2, dice3] });
        if (history.length > 10) history.pop();

        // Xử lý các cược
        const winners = [];
        const losers = [];
        let totalPayout = 0;
        
        for (const [userId, bet] of session.bets) {
            let won = false;
            let payout = 0;

            if ((bet.type === 'tai' && result === 'tai') || 
                (bet.type === 'xiu' && result === 'xiu')) {
                won = true;
                payout = Math.floor(bet.amount * 1.95);
            } else if (bet.type === 'hoa' && result === 'hoa') {
                won = true;
                payout = bet.amount * 14;
            }

            if (won) {
                await Database.updateUserBalance(userId, payout);
                await Database.updateGameStats(userId, 'sicbo', 'win');
                await Database.updateUserXP(userId, 10);
                winners.push({ userId, bet, payout });
                totalPayout += payout;
            } else {
                await Database.updateGameStats(userId, 'sicbo', 'lose');
                await Database.updateUserXP(userId, 2);
                losers.push({ userId, bet });
            }
        }

        // Tăng round number
        session.roundNumber++;

        return {
            dice: [dice1, dice2, dice3],
            total,
            result,
            resultEmoji,
            winners,
            losers,
            totalPayout,
            roundNumber: session.roundNumber - 1
        };
    }

    stopGame(channelId) {
        const session = this.sessions.get(channelId);
        if (session) {
            session.isActive = false;
            this.sessions.delete(channelId);
        }
        
        // Clear timer nếu có
        if (this.timers.has(channelId)) {
            clearTimeout(this.timers.get(channelId));
            this.timers.delete(channelId);
        }
    }

    getHistory(channelId) {
        return this.history.get(channelId) || [];
    }
}

const sicBoGame = new SicBoGame();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sicbo')
        .setDescription('Chơi tài xỉu tự động với thời gian thực')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Hành động')
                .setRequired(false)
                .addChoices(
                    { name: '🎲 Bắt đầu game', value: 'start' },
                    { name: '📊 Xem lịch sử', value: 'history' },
                    { name: '⏹️ Dừng game', value: 'stop' }
                )),

    async execute(interaction) {
        const action = interaction.options.getString('action') || 'start';
        const channelId = interaction.channelId;

        if (action === 'history') {
            await this.showHistory(interaction, channelId);
        } else if (action === 'stop') {
            await this.stopGame(interaction, channelId);
        } else {
            await this.startGame(interaction, channelId);
        }
    },

    async startGame(interaction, channelId) {
        // Bắt đầu game tự động
        const gameData = sicBoGame.startAutoGame(channelId);
        
        if (!gameData) {
            return interaction.reply({ content: '❌ Game đã đang chạy trong channel này!', ephemeral: true });
        }

        const buttons = this.createGameButtons();
        
        const message = await interaction.reply({ 
            embeds: [gameData.embed], 
            components: buttons,
            fetchReply: true
        });

        // Lưu message để update sau
        const session = sicBoGame.sessions.get(channelId);
        session.message = message;

        // Bắt đầu auto loop
        await this.startAutoLoop(message, channelId);
    },

    async startAutoLoop(message, channelId) {
        const session = sicBoGame.sessions.get(channelId);
        if (!session || !session.isActive) return;

        // Tự động kết thúc phiên sau 30 giây
        const timer = setTimeout(async () => {
            await this.finishCurrentRound(message, channelId);
        }, sicBoGame.roundDuration);

        sicBoGame.timers.set(channelId, timer);
    },

    async finishCurrentRound(message, channelId) {
        const result = await sicBoGame.finishRound(channelId);
        if (!result) return;

        // Tạo embed kết quả
        const resultEmbed = new EmbedBuilder()
            .setTitle(`🎲 Kết quả Phiên ${result.roundNumber}`)
            .setDescription(`**🎯 ${result.dice[0]} - ${result.dice[1]} - ${result.dice[2]} = ${result.total} điểm**\n\n${result.resultEmoji} **${this.getResultName(result.result).toUpperCase()}**`)
            .setColor(result.result === 'tai' ? '#00ff00' : result.result === 'xiu' ? '#ff0000' : '#ffaa00')
            .setTimestamp()
            .setFooter({ text: `Phiên ${result.roundNumber} kết thúc | Phiên mới bắt đầu sau 5 giây` });

        // Thêm thông tin winners/losers
        if (result.winners.length > 0) {
            const winnerList = result.winners.slice(0, 5).map(w => 
                `<@${w.userId}>: +${w.payout.toLocaleString()} coins`
            ).join('\n');
            
            if (result.winners.length > 5) {
                resultEmbed.addFields({ 
                    name: `🎉 Người thắng (${result.winners.length})`, 
                    value: winnerList + `\n*...và ${result.winners.length - 5} người khác*`, 
                    inline: false 
                });
            } else {
                resultEmbed.addFields({ 
                    name: `🎉 Người thắng (${result.winners.length})`, 
                    value: winnerList, 
                    inline: false 
                });
            }
        }

        if (result.losers.length > 0) {
            const loserList = result.losers.slice(0, 5).map(l => 
                `<@${l.userId}>: -${l.bet.amount.toLocaleString()} coins`
            ).join('\n');
            
            if (result.losers.length > 5) {
                resultEmbed.addFields({ 
                    name: `😢 Người thua (${result.losers.length})`, 
                    value: loserList + `\n*...và ${result.losers.length - 5} người khác*`, 
                    inline: false 
                });
            } else {
                resultEmbed.addFields({ 
                    name: `😢 Người thua (${result.losers.length})`, 
                    value: loserList, 
                    inline: false 
                });
            }
        }

        if (result.winners.length === 0 && result.losers.length === 0) {
            resultEmbed.addFields({ name: '📊 Kết quả', value: 'Không có ai tham gia phiên này', inline: false });
        }

        await message.edit({ embeds: [resultEmbed], components: [] });

        // Bắt đầu phiên mới sau 5 giây
        setTimeout(async () => {
            const session = sicBoGame.sessions.get(channelId);
            if (!session || !session.isActive) return;

            const newGameData = sicBoGame.runRound(channelId);
            if (newGameData) {
                const buttons = this.createGameButtons();
                await message.edit({ 
                    embeds: [newGameData.embed], 
                    components: buttons
                });

                // Bắt đầu timer cho phiên mới
                await this.startAutoLoop(message, channelId);
            }
        }, 5000);
    },

    createGameButtons() {
        // Hàng 1: Cược Tài/Xỉu/Hòa
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('sicbo_bet_tai')
                    .setLabel('🟢 TÀI (11-17)')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('sicbo_bet_xiu')
                    .setLabel('🔴 XỈU (4-10)')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('sicbo_bet_hoa')
                    .setLabel('💎 HÒA (3,18)')
                    .setStyle(ButtonStyle.Secondary)
            );

        // Hàng 2: Mức cược nhanh
        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('sicbo_quick_100')
                    .setLabel('💰 100')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('sicbo_quick_500')
                    .setLabel('💰 500')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('sicbo_quick_1000')
                    .setLabel('💰 1,000')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('sicbo_custom')
                    .setLabel('✏️ Tùy chỉnh')
                    .setStyle(ButtonStyle.Secondary)
            );

        // Hàng 3: Utilities
        const row3 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('sicbo_history')
                    .setLabel('📊 Lịch sử')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('sicbo_stats')
                    .setLabel('📈 Thống kê')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('sicbo_stop')
                    .setLabel('⏹️ Dừng')
                    .setStyle(ButtonStyle.Danger)
            );

        return [row1, row2, row3];
    },

    async showHistory(interaction, channelId) {
        const history = sicBoGame.getHistory(channelId);
        
        if (history.length === 0) {
            return interaction.reply({ 
                content: '📊 Chưa có lịch sử phiên nào!', 
                ephemeral: true 
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('📊 Lịch sử 10 phiên gần nhất')
            .setColor('#9932cc')
            .setTimestamp();

        const historyText = history.map(h => {
            const resultEmoji = h.result === 'tai' ? '🟢' : h.result === 'xiu' ? '🔴' : '💎';
            const resultName = this.getResultName(h.result);
            return `**Phiên ${h.round}:** ${h.dice.join('-')} = ${h.total} ${resultEmoji} ${resultName}`;
        }).join('\n');

        embed.setDescription(historyText);

        // Thống kê
        const taiCount = history.filter(h => h.result === 'tai').length;
        const xiuCount = history.filter(h => h.result === 'xiu').length;
        const hoaCount = history.filter(h => h.result === 'hoa').length;

        embed.addFields({
            name: '📈 Thống kê',
            value: `🟢 Tài: ${taiCount} lần (${((taiCount/history.length)*100).toFixed(1)}%)\n🔴 Xỉu: ${xiuCount} lần (${((xiuCount/history.length)*100).toFixed(1)}%)\n💎 Hòa: ${hoaCount} lần (${((hoaCount/history.length)*100).toFixed(1)}%)`,
            inline: true
        });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },

    async stopGame(interaction, channelId) {
        sicBoGame.stopGame(channelId);
        
        const embed = new EmbedBuilder()
            .setTitle('⏹️ Game đã dừng')
            .setDescription('Tài xỉu tự động đã được dừng!')
            .setColor('#ff0000')
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    getResultName(result) {
        const names = {
            'tai': 'Tài',
            'xiu': 'Xỉu', 
            'hoa': 'Hòa'
        };
        return names[result] || result;
    }
};

// State management cho sicbo betting
const bettingStates = new Map(); // userId -> {betType, channelId, timestamp}

// Xử lý button interactions
module.exports.handleButtonInteraction = async (interaction) => {
    if (!interaction.customId.startsWith('sicbo_')) return false;

    const [, action, param] = interaction.customId.split('_');
    const userId = interaction.user.id;
    const channelId = interaction.channelId;
    const username = interaction.user.username;

    await Database.createUser(userId, username);
    const user = await Database.getUser(userId);

    if (action === 'bet') {
        // Lưu trạng thái cược
        bettingStates.set(userId, {
            betType: param,
            channelId: channelId,
            timestamp: Date.now()
        });

        const betNames = {
            'tai': '🟢 TÀI (11-17)',
            'xiu': '🔴 XỈU (4-10)',
            'hoa': '💎 HÒA (3,18)'
        };

        return interaction.reply({ 
            content: `🎯 Bạn đã chọn **${betNames[param]}**!\n💰 Chọn mức cược bên dưới hoặc tùy chỉnh.`, 
            ephemeral: true 
        });
    }

    if (action === 'quick') {
        const betAmount = parseInt(param);
        const state = bettingStates.get(userId);
        
        if (!state || Date.now() - state.timestamp > 300000) { // 5 phút timeout
            return interaction.reply({ 
                content: '⚠️ Vui lòng chọn Tài/Xỉu/Hòa trước khi chọn mức cược!', 
                ephemeral: true 
            });
        }

        if (user.balance < betAmount) {
            return interaction.reply({ 
                content: `❌ Bạn không đủ tiền! Cần ${betAmount.toLocaleString()} coins.`, 
                ephemeral: true 
            });
        }

        // Đặt cược
        const result = sicBoGame.placeBet(channelId, userId, state.betType, betAmount);
        
        if (result.success) {
            await Database.updateUserBalance(userId, -betAmount);
            bettingStates.delete(userId);
            
            // Cập nhật embed với thông tin mới
            const session = sicBoGame.sessions.get(channelId);
            if (session && session.message) {
                const updatedEmbed = sicBoGame.updateBettingDisplay(channelId);
                if (updatedEmbed) {
                    await session.message.edit({ 
                        embeds: [updatedEmbed], 
                        components: session.message.components 
                    });
                }
            }

            const betNames = {
                'tai': '🟢 TÀI',
                'xiu': '🔴 XỈU',
                'hoa': '💎 HÒA'
            };
            
            return interaction.reply({ 
                content: `✅ Đặt cược thành công!\n🎯 **${betNames[state.betType]}** - ${betAmount.toLocaleString()} coins\n⏰ Còn ${Math.ceil(result.timeLeft/1000)} giây để kết thúc phiên`, 
                ephemeral: true 
            });
        } else {
            return interaction.reply({ 
                content: `❌ ${result.message}`, 
                ephemeral: true 
            });
        }
    }

    if (action === 'custom') {
        const state = bettingStates.get(userId);
        
        if (!state || Date.now() - state.timestamp > 300000) {
            return interaction.reply({ 
                content: '⚠️ Vui lòng chọn Tài/Xỉu/Hòa trước!', 
                ephemeral: true 
            });
        }

        const betNames = {
            'tai': '🟢 TÀI',
            'xiu': '🔴 XỈU',
            'hoa': '💎 HÒA'
        };

        const modal = new ModalBuilder()
            .setCustomId(`sicbo_custom_modal_${state.betType}`)
            .setTitle(`Cược ${betNames[state.betType]} - Tùy chỉnh`);

        const amountInput = new TextInputBuilder()
            .setCustomId('bet_amount')
            .setLabel('Số tiền cược')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Nhập số tiền (tối thiểu 50)')
            .setRequired(true)
            .setMaxLength(10);

        const firstActionRow = new ActionRowBuilder().addComponents(amountInput);
        modal.addComponents(firstActionRow);

        return interaction.showModal(modal);
    }

    if (action === 'history') {
        return module.exports.showHistory(interaction, channelId);
    }

    if (action === 'stop') {
        return module.exports.stopGame(interaction, channelId);
    }

    if (action === 'stats') {
        const stats = await Database.getGameStats(userId, 'sicbo') || { wins: 0, losses: 0, total_games: 0 };
        
        const embed = new EmbedBuilder()
            .setTitle('📈 Thống kê Tài Xỉu của bạn')
            .addFields(
                { name: '🎮 Tổng phiên', value: `${stats.total_games}`, inline: true },
                { name: '🏆 Thắng', value: `${stats.wins}`, inline: true },
                { name: '😢 Thua', value: `${stats.losses}`, inline: true },
                { name: '📈 Tỷ lệ thắng', value: `${stats.total_games > 0 ? ((stats.wins / stats.total_games) * 100).toFixed(1) : 0}%`, inline: true },
                { name: '💰 Số dư hiện tại', value: `${user.balance.toLocaleString()} coins`, inline: true }
            )
            .setColor('#9932cc')
            .setTimestamp()
            .setFooter({ text: 'Chơi nhiều hơn để cải thiện thống kê!' });

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    return false;
};

// Xử lý modal submit cho custom betting
module.exports.handleModalSubmit = async (interaction) => {
    if (!interaction.customId.startsWith('sicbo_custom_modal_')) return false;

    const betType = interaction.customId.split('_')[3];
    const userId = interaction.user.id;
    const channelId = interaction.channelId;
    const betAmount = parseInt(interaction.fields.getTextInputValue('bet_amount'));

    if (isNaN(betAmount) || betAmount < 50) {
        return interaction.reply({ 
            content: '❌ Số tiền cược không hợp lệ! Tối thiểu 50 coins.', 
            ephemeral: true 
        });
    }

    if (betAmount > 100000) {
        return interaction.reply({ 
            content: '❌ Số tiền cược tối đa 100,000 coins!', 
            ephemeral: true 
        });
    }

    const user = await Database.getUser(userId);
    if (user.balance < betAmount) {
        return interaction.reply({ 
            content: `❌ Bạn không đủ tiền! Cần ${betAmount.toLocaleString()} coins.`, 
            ephemeral: true 
        });
    }

    // Đặt cược
    const result = sicBoGame.placeBet(channelId, userId, betType, betAmount);
    
    if (result.success) {
        await Database.updateUserBalance(userId, -betAmount);
        bettingStates.delete(userId);
        
        // Cập nhật embed
        const session = sicBoGame.sessions.get(channelId);
        if (session && session.message) {
            const updatedEmbed = sicBoGame.updateBettingDisplay(channelId);
            if (updatedEmbed) {
                await session.message.edit({ 
                    embeds: [updatedEmbed], 
                    components: session.message.components 
                });
            }
        }

        const betNames = {
            'tai': '🟢 TÀI',
            'xiu': '🔴 XỈU',
            'hoa': '💎 HÒA'
        };
        
        return interaction.reply({ 
            content: `✅ Đặt cược thành công!\n🎯 **${betNames[betType]}** - ${betAmount.toLocaleString()} coins\n⏰ Còn ${Math.ceil(result.timeLeft/1000)} giây để kết thúc phiên`, 
            ephemeral: true 
        });
    } else {
        return interaction.reply({ 
            content: `❌ ${result.message}`, 
            ephemeral: true 
        });
    }
};