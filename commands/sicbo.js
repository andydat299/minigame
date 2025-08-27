const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Database = require('../database/database');

// State management cho sicbo betting
const bettingStates = new Map(); // userId -> {betType, channelId, timestamp}

module.exports = {
    name: 'sicbo',
    description: 'Chơi tài xỉu tự động với nhiều người',

    async execute(message, args, client) {
        // Redirect to slash command
        return message.reply('🎲 Tính năng Tài Xỉu chỉ hỗ trợ Slash Command! Sử dụng `/sicbo` để chơi.');
    },

    // Xử lý button interactions cho prefix command
    async handleButtonClick(interaction, sicboGame) {
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

            return interaction.reply({ 
                content: `🎯 Bạn đã chọn **${this.getBetDisplayName(param)}**!\n💰 Chọn mức cược hoặc tùy chỉnh số tiền.`, 
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
            const result = sicboGame.placeBet(channelId, userId, state.betType, betAmount);
            
            if (result.success) {
                await Database.updateUserBalance(userId, -betAmount);
                bettingStates.delete(userId);
                
                return interaction.reply({ 
                    content: `✅ Đặt cược thành công!\n🎯 **${this.getBetDisplayName(state.betType)}** - ${betAmount.toLocaleString()} coins`, 
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

            const modal = new ModalBuilder()
                .setCustomId(`sicbo_custom_modal_${state.betType}`)
                .setTitle(`Cược ${this.getBetDisplayName(state.betType)} - Tùy chỉnh`);

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

        return false;
    },

    // Xử lý modal submit
    async handleModalSubmit(interaction, sicboGame) {
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

        const user = await Database.getUser(userId);
        if (user.balance < betAmount) {
            return interaction.reply({ 
                content: `❌ Bạn không đủ tiền! Cần ${betAmount.toLocaleString()} coins.`, 
                ephemeral: true 
            });
        }

        // Đặt cược
        const result = sicboGame.placeBet(channelId, userId, betType, betAmount);
        
        if (result.success) {
            await Database.updateUserBalance(userId, -betAmount);
            bettingStates.delete(userId);
            
            return interaction.reply({ 
                content: `✅ Đặt cược thành công!\n🎯 **${this.getBetDisplayName(betType)}** - ${betAmount.toLocaleString()} coins`, 
                ephemeral: true 
            });
        } else {
            return interaction.reply({ 
                content: `❌ ${result.message}`, 
                ephemeral: true 
            });
        }
    },

    getBetDisplayName(betType) {
        const names = {
            'tai': '🟢 TÀI (11-17)',
            'xiu': '🔴 XỈU (4-10)',
            'hoa': '💎 HÒA (3,18)'
        };
        return names[betType] || betType;
    }
};