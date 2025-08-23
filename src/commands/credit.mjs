import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import User from '../models/User.mjs';
import { formatCurrency, errorEmbed } from './util.mjs';
import { getLoanStats, calculateCreditScore, getCreditRating } from '../game/loanManager.mjs';

export const data = new SlashCommandBuilder()
    .setName('credit')
    .setDescription('Xem điểm tín dụng và lịch sử vay nợ')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('Người dùng muốn xem tín dụng')
            .setRequired(false));

export async function execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const userId = targetUser.id;
    const guildId = interaction.guildId;
    
    let profile = await User.findOne({ userId, guildId });
    if (!profile) profile = await User.create({ userId, guildId });

    // Get loan statistics
    const stats = await getLoanStats(userId, guildId);
    if (!stats) {
        return interaction.reply({ 
            embeds: [errorEmbed('Có lỗi xảy ra khi tính toán thống kê.')], 
            ephemeral: true 
        });
    }

    // Calculate credit score
    const creditScore = calculateCreditScore(stats);
    const creditRating = getCreditRating(creditScore);

    const embed = new EmbedBuilder()
        .setColor(creditRating.color)
        .setTitle(`💳 Tín Dụng - ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
            { 
                name: '📊 Điểm Tín Dụng', 
                value: `${creditRating.emoji} **${creditScore}/850**\n*${creditRating.rating}*`, 
                inline: true 
            },
            { 
                name: '💰 Tổng Cho Vay', 
                value: formatCurrency(stats.totalLent), 
                inline: true 
            },
            { 
                name: '💸 Tổng Đi Vay', 
                value: formatCurrency(stats.totalBorrowed), 
                inline: true 
            },
            { 
                name: '🔄 Cho Vay Hiện Tại', 
                value: formatCurrency(stats.activeLending), 
                inline: true 
            },
            { 
                name: '⏳ Đang Nợ', 
                value: formatCurrency(stats.activeBorrowing), 
                inline: true 
            },
            { 
                name: '✅ Khoản Vay Hoàn Thành', 
                value: `${stats.completedLoans}`, 
                inline: true 
            },
            { 
                name: '📈 Lãi Đã Kiếm', 
                value: formatCurrency(stats.totalInterestEarned), 
                inline: true 
            },
            { 
                name: '📉 Lãi Đã Trả', 
                value: formatCurrency(stats.totalInterestPaid), 
                inline: true 
            },
            { 
                name: '❌ Khoản Vay Mặc Định', 
                value: `${stats.defaultedLoans}`, 
                inline: true 
            }
        )
        .setTimestamp();

    // Add credit advice
    let advice = '';
    if (creditScore >= 750) {
        advice = '🌟 Tín dụng xuất sắc! Bạn có thể dễ dàng vay với lãi suất thấp.';
    } else if (creditScore >= 650) {
        advice = '✅ Tín dụng tốt! Hãy tiếp tục duy trì lịch sử thanh toán đúng hạn.';
    } else if (creditScore >= 550) {
        advice = '🟡 Tín dụng khá. Hãy hoàn thành thêm khoản vay để cải thiện điểm.';
    } else {
        advice = '🔴 Tín dụng cần cải thiện. Hãy trả nợ đúng hạn và tránh mặc định.';
    }

    embed.addFields({ name: '💡 Lời Khuyên', value: advice, inline: false });

    // Add credit history summary
    const totalLoans = stats.completedLoans + stats.defaultedLoans;
    if (totalLoans > 0) {
        const successRate = Math.round((stats.completedLoans / totalLoans) * 100);
        embed.addFields({ 
            name: '📊 Tỷ Lệ Thành Công', 
            value: `${successRate}% (${stats.completedLoans}/${totalLoans})`, 
            inline: false 
        });
    }

    await interaction.reply({ embeds: [embed] });
}