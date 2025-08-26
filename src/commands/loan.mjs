import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import User from '../models/User.mjs';
import Loan from '../models/Loan.mjs';
import { formatCurrency, successEmbed, errorEmbed } from './util.mjs';

export const data = new SlashCommandBuilder()
    .setName('loan')
    .setDescription('Hệ thống cho vay')
    .addSubcommand(subcommand =>
        subcommand
            .setName('offer')
            .setDescription('Đưa ra đề nghị cho vay')
            .addUserOption(option =>
                option.setName('borrower')
                    .setDescription('Người muốn vay tiền')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('amount')
                    .setDescription('Số tiền cho vay')
                    .setRequired(true)
                    .setMinValue(1000))
            .addNumberOption(option =>
                option.setName('interest_rate')
                    .setDescription('Lãi suất mỗi ngày (%)')
                    .setRequired(true)
                    .setMinValue(0.1)
                    .setMaxValue(10))
            .addIntegerOption(option =>
                option.setName('duration')
                    .setDescription('Thời hạn vay (ngày)')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(30)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('request')
            .setDescription('Yêu cầu vay tiền')
            .addUserOption(option =>
                option.setName('lender')
                    .setDescription('Người cho vay')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('amount')
                    .setDescription('Số tiền muốn vay')
                    .setRequired(true)
                    .setMinValue(1000))
            .addIntegerOption(option =>
                option.setName('duration')
                    .setDescription('Thời hạn vay (ngày)')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(30)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('accept')
            .setDescription('Chấp nhận khoản vay')
            .addStringOption(option =>
                option.setName('loan_id')
                    .setDescription('ID khoản vay')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('repay')
            .setDescription('Trả nợ')
            .addStringOption(option =>
                option.setName('loan_id')
                    .setDescription('ID khoản vay')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('amount')
                    .setDescription('Số tiền trả (để trống = trả hết)')
                    .setRequired(false)
                    .setMinValue(100)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('list')
            .setDescription('Xem danh sách khoản vay')
            .addStringOption(option =>
                option.setName('type')
                    .setDescription('Loại khoản vay')
                    .addChoices(
                        { name: 'Tôi cho vay', value: 'lending' },
                        { name: 'Tôi đi vay', value: 'borrowing' },
                        { name: 'Chờ phê duyệt', value: 'pending' },
                        { name: 'Đang hoạt động', value: 'active' }
                    )))
    .addSubcommand(subcommand =>
        subcommand
            .setName('cancel')
            .setDescription('Hủy khoản vay')
            .addStringOption(option =>
                option.setName('loan_id')
                    .setDescription('ID khoản vay')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('info')
            .setDescription('Xem thông tin chi tiết khoản vay')
            .addStringOption(option =>
                option.setName('loan_id')
                    .setDescription('ID khoản vay')
                    .setRequired(true)));

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
        case 'offer':
            await handleOffer(interaction);
            break;
        case 'request':
            await handleRequest(interaction);
            break;
        case 'accept':
            await handleAccept(interaction);
            break;
        case 'repay':
            await handleRepay(interaction);
            break;
        case 'list':
            await handleList(interaction);
            break;
        case 'cancel':
            await handleCancel(interaction);
            break;
        case 'info':
            await handleInfo(interaction);
            break;
    }
}

async function handleOffer(interaction) {
    const borrower = interaction.options.getUser('borrower');
    const amount = interaction.options.getInteger('amount');
    const interestRate = interaction.options.getNumber('interest_rate');
    const duration = interaction.options.getInteger('duration');
    
    const lenderId = interaction.user.id;
    const guildId = interaction.guildId;
    
    // Check if offering to self
    if (borrower.id === lenderId) {
        return interaction.reply({ 
            embeds: [errorEmbed('Bạn không thể cho chính mình vay!')], 
            ephemeral: true 
        });
    }
    
    // Check lender's balance
    let lenderProfile = await User.findOne({ userId: lenderId, guildId });
    if (!lenderProfile || (lenderProfile.coins || 0) < amount) {
        return interaction.reply({ 
            embeds: [errorEmbed(`Bạn không đủ tiền để cho vay ${formatCurrency(amount)}!`)], 
            ephemeral: true 
        });
    }
    
    // Calculate total repayment
    const dailyInterest = (amount * interestRate / 100);
    const totalInterest = dailyInterest * duration;
    const totalRepayment = Math.ceil(amount + totalInterest);
    
    // Create loan
    const loanId = `LOAN_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const dueDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    
    const loan = await Loan.create({
        loanId,
        lenderId,
        borrowerId: borrower.id,
        guildId,
        amount,
        interestRate,
        duration,
        totalRepayment,
        remainingAmount: totalRepayment,
        dueDate,
        status: 'pending'
    });
    
    const embed = new EmbedBuilder()
        .setColor('#48dbfb')
        .setTitle('💰 Đề Nghị Cho Vay')
        .setDescription(`<@${lenderId}> đã đề nghị cho <@${borrower.id}> vay tiền!`)
        .addFields(
            { name: '💵 Số Tiền Vay', value: formatCurrency(amount), inline: true },
            { name: '📈 Lãi Suất', value: `${interestRate}%/ngày`, inline: true },
            { name: '⏰ Thời Hạn', value: `${duration} ngày`, inline: true },
            { name: '💸 Lãi Phải Trả', value: formatCurrency(Math.ceil(totalInterest)), inline: true },
            { name: '💰 Tổng Phải Trả', value: formatCurrency(totalRepayment), inline: true },
            { name: '📅 Hạn Trả', value: `<t:${Math.floor(dueDate.getTime() / 1000)}:F>`, inline: true },
            { name: '🆔 Loan ID', value: `\`${loanId}\``, inline: false }
        )
        .setFooter({ text: `${borrower.username} có thể nhấn nút để chấp nhận hoặc từ chối` })
        .setTimestamp();

    // Add buttons for accept/decline
    const acceptButton = new ButtonBuilder()
        .setCustomId(`loan_accept_${loanId}`)
        .setLabel('✅ Chấp Nhận')
        .setStyle(ButtonStyle.Success);

    const declineButton = new ButtonBuilder()
        .setCustomId(`loan_decline_${loanId}`)
        .setLabel('❌ Từ Chối')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(acceptButton, declineButton);
    
    await interaction.reply({ embeds: [embed], components: [row] });
}

async function handleRequest(interaction) {
    const lender = interaction.options.getUser('lender');
    const amount = interaction.options.getInteger('amount');
    const duration = interaction.options.getInteger('duration');
    
    const borrowerId = interaction.user.id;
    const guildId = interaction.guildId;
    
    // Check if requesting from self
    if (lender.id === borrowerId) {
        return interaction.reply({ 
            embeds: [errorEmbed('Bạn không thể vay tiền từ chính mình!')], 
            ephemeral: true 
        });
    }
    
    // Create loan request with 0% interest (lender can counter-offer)
    const loanId = `REQ_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const dueDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    
    const loan = await Loan.create({
        loanId,
        lenderId: lender.id,
        borrowerId,
        guildId,
        amount,
        interestRate: 0,
        duration,
        totalRepayment: amount,
        remainingAmount: amount,
        dueDate,
        status: 'pending'
    });
    
    const embed = new EmbedBuilder()
        .setColor('#feca57')
        .setTitle('🙏 Yêu Cầu Vay Tiền')
        .setDescription(`<@${borrowerId}> yêu cầu vay tiền từ <@${lender.id}>!`)
        .addFields(
            { name: '💵 Số Tiền Vay', value: formatCurrency(amount), inline: true },
            { name: '⏰ Thời Hạn', value: `${duration} ngày`, inline: true },
            { name: '📅 Hạn Trả', value: `<t:${Math.floor(dueDate.getTime() / 1000)}:F>`, inline: true },
            { name: '🆔 Loan ID', value: `\`${loanId}\``, inline: false }
        )
        .setFooter({ text: `${lender.username} có thể nhấn nút để chấp nhận với lãi suất tùy chọn` })
        .setTimestamp();

    // Add buttons for different interest rates
    const lowInterestButton = new ButtonBuilder()
        .setCustomId(`loan_approve_${loanId}_1`)
        .setLabel('✅ 1%/ngày')
        .setStyle(ButtonStyle.Success);

    const mediumInterestButton = new ButtonBuilder()
        .setCustomId(`loan_approve_${loanId}_2`)
        .setLabel('✅ 2%/ngày') 
        .setStyle(ButtonStyle.Primary);

    const highInterestButton = new ButtonBuilder()
        .setCustomId(`loan_approve_${loanId}_3`)
        .setLabel('✅ 3%/ngày')
        .setStyle(ButtonStyle.Secondary);

    const declineButton = new ButtonBuilder()
        .setCustomId(`loan_decline_${loanId}`)
        .setLabel('❌ Từ Chối')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(lowInterestButton, mediumInterestButton, highInterestButton, declineButton);
    
    await interaction.reply({ embeds: [embed], components: [row] });
}

async function handleAccept(interaction) {
    const loanId = interaction.options.getString('loan_id');
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    const loan = await Loan.findOne({ loanId, guildId, status: 'pending' });
    if (!loan) {
        return interaction.reply({ 
            embeds: [errorEmbed('Không tìm thấy khoản vay hoặc khoản vay đã được xử lý!')], 
            ephemeral: true 
        });
    }
    
    // Check if user is the borrower
    if (loan.borrowerId !== userId) {
        return interaction.reply({ 
            embeds: [errorEmbed('Chỉ người vay mới có thể chấp nhận khoản vay này!')], 
            ephemeral: true 
        });
    }
    
    // Check lender's balance
    let lenderProfile = await User.findOne({ userId: loan.lenderId, guildId });
    if (!lenderProfile || (lenderProfile.coins || 0) < loan.amount) {
        return interaction.reply({ 
            embeds: [errorEmbed('Người cho vay không đủ tiền!')], 
            ephemeral: true 
        });
    }
    
    // Process loan
    let borrowerProfile = await User.findOne({ userId: loan.borrowerId, guildId });
    if (!borrowerProfile) borrowerProfile = await User.create({ userId: loan.borrowerId, guildId });
    
    // Transfer money
    lenderProfile.coins = (lenderProfile.coins || 0) - loan.amount;
    borrowerProfile.coins = (borrowerProfile.coins || 0) + loan.amount;
    
    // Update loan status
    loan.status = 'active';
    loan.approvedAt = new Date();
    
    await lenderProfile.save();
    await borrowerProfile.save();
    await loan.save();
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Khoản Vay Đã Được Chấp Nhận')
        .setDescription(`Khoản vay \`${loanId}\` đã được kích hoạt!`)
        .addFields(
            { name: '💵 Số Tiền Nhận', value: formatCurrency(loan.amount), inline: true },
            { name: '💰 Tổng Phải Trả', value: formatCurrency(loan.totalRepayment), inline: true },
            { name: '📅 Hạn Trả', value: `<t:${Math.floor(loan.dueDate.getTime() / 1000)}:F>`, inline: true }
        )
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

async function handleRepay(interaction) {
    const loanId = interaction.options.getString('loan_id');
    const repayAmount = interaction.options.getInteger('amount');
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    const loan = await Loan.findOne({ loanId, guildId, status: 'active' });
    if (!loan) {
        return interaction.reply({ 
            embeds: [errorEmbed('Không tìm thấy khoản vay hoạt động!')], 
            ephemeral: true 
        });
    }
    
    // Check if user is the borrower
    if (loan.borrowerId !== userId) {
        return interaction.reply({ 
            embeds: [errorEmbed('Chỉ người vay mới có thể trả nợ!')], 
            ephemeral: true 
        });
    }
    
    let borrowerProfile = await User.findOne({ userId, guildId });
    if (!borrowerProfile) borrowerProfile = await User.create({ userId, guildId });
    
    const actualRepayAmount = repayAmount || loan.remainingAmount;
    const finalRepayAmount = Math.min(actualRepayAmount, loan.remainingAmount);
    
    // Check borrower's balance
    if ((borrowerProfile.coins || 0) < finalRepayAmount) {
        return interaction.reply({ 
            embeds: [errorEmbed(`Bạn không đủ tiền để trả ${formatCurrency(finalRepayAmount)}!`)], 
            ephemeral: true 
        });
    }
    
    // Process repayment
    let lenderProfile = await User.findOne({ userId: loan.lenderId, guildId });
    if (!lenderProfile) lenderProfile = await User.create({ userId: loan.lenderId, guildId });
    
    borrowerProfile.coins = (borrowerProfile.coins || 0) - finalRepayAmount;
    lenderProfile.coins = (lenderProfile.coins || 0) + finalRepayAmount;
    
    loan.paidAmount += finalRepayAmount;
    loan.remainingAmount -= finalRepayAmount;
    loan.payments.push({
        amount: finalRepayAmount,
        timestamp: new Date()
    });
    
    // Check if loan is fully repaid
    if (loan.remainingAmount <= 0) {
        loan.status = 'completed';
        loan.completedAt = new Date();
    }
    
    await borrowerProfile.save();
    await lenderProfile.save();
    await loan.save();
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('💸 Đã Trả Nợ')
        .setDescription(`Đã trả ${formatCurrency(finalRepayAmount)} cho khoản vay \`${loanId}\``)
        .addFields(
            { name: '💰 Số Tiền Trả', value: formatCurrency(finalRepayAmount), inline: true },
            { name: '💵 Còn Lại', value: formatCurrency(loan.remainingAmount), inline: true },
            { name: '📊 Trạng Thái', value: loan.status === 'completed' ? '✅ Đã hoàn thành' : '🔄 Chưa hoàn thành', inline: true }
        )
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

async function handleList(interaction) {
    const type = interaction.options.getString('type') || 'active';
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    let query = { guildId };
    
    switch (type) {
        case 'lending':
            query.lenderId = userId;
            query.status = { $in: ['pending', 'active'] };
            break;
        case 'borrowing':
            query.borrowerId = userId;
            query.status = { $in: ['pending', 'active'] };
            break;
        case 'pending':
            query.$or = [{ lenderId: userId }, { borrowerId: userId }];
            query.status = 'pending';
            break;
        case 'active':
            query.$or = [{ lenderId: userId }, { borrowerId: userId }];
            query.status = 'active';
            break;
    }
    
    const loans = await Loan.find(query).sort({ createdAt: -1 }).limit(10);
    
    const embed = new EmbedBuilder()
        .setColor('#48dbfb')
        .setTitle(`💰 Danh Sách Khoản Vay - ${getTypeTitle(type)}`)
        .setTimestamp();
    
    if (loans.length === 0) {
        embed.setDescription('Không có khoản vay nào.');
        return interaction.reply({ embeds: [embed] });
    }
    
    const loanList = loans.map(loan => {
        const isLender = loan.lenderId === userId;
        const otherParty = isLender ? `<@${loan.borrowerId}>` : `<@${loan.lenderId}>`;
        const role = isLender ? 'Cho vay' : 'Đi vay';
        const statusEmoji = getStatusEmoji(loan.status);
        
        return `**${loan.loanId}** ${statusEmoji}\n${role}: ${otherParty}\n💰 ${formatCurrency(loan.amount)} → ${formatCurrency(loan.totalRepayment)}\n📅 <t:${Math.floor(loan.dueDate.getTime() / 1000)}:R>\n`;
    }).join('\n');
    
    embed.setDescription(loanList);
    embed.setFooter({ text: 'Dùng /loan info <loan_id> để xem chi tiết' });
    
    await interaction.reply({ embeds: [embed] });
}

async function handleCancel(interaction) {
    const loanId = interaction.options.getString('loan_id');
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    const loan = await Loan.findOne({ loanId, guildId, status: 'pending' });
    if (!loan) {
        return interaction.reply({ 
            embeds: [errorEmbed('Không tìm thấy khoản vay chờ xử lý!')], 
            ephemeral: true 
        });
    }
    
    // Check if user is involved in the loan
    if (loan.lenderId !== userId && loan.borrowerId !== userId) {
        return interaction.reply({ 
            embeds: [errorEmbed('Bạn không có quyền hủy khoản vay này!')], 
            ephemeral: true 
        });
    }
    
    loan.status = 'cancelled';
    await loan.save();
    
    const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Đã Hủy Khoản Vay')
        .setDescription(`Khoản vay \`${loanId}\` đã được hủy.`)
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

async function handleInfo(interaction) {
    const loanId = interaction.options.getString('loan_id');
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    const loan = await Loan.findOne({ loanId, guildId });
    if (!loan) {
        return interaction.reply({ 
            embeds: [errorEmbed('Không tìm thấy khoản vay!')], 
            ephemeral: true 
        });
    }
    
    // Check if user is involved in the loan
    if (loan.lenderId !== userId && loan.borrowerId !== userId) {
        return interaction.reply({ 
            embeds: [errorEmbed('Bạn không có quyền xem khoản vay này!')], 
            ephemeral: true 
        });
    }
    
    const isOverdue = loan.status === 'active' && new Date() > loan.dueDate;
    const statusEmoji = getStatusEmoji(loan.status);
    
    const embed = new EmbedBuilder()
        .setColor(isOverdue ? '#ff6b6b' : '#48dbfb')
        .setTitle(`💰 Chi Tiết Khoản Vay - ${loan.loanId}`)
        .addFields(
            { name: '👤 Người Cho Vay', value: `<@${loan.lenderId}>`, inline: true },
            { name: '👤 Người Vay', value: `<@${loan.borrowerId}>`, inline: true },
            { name: '📊 Trạng Thái', value: `${statusEmoji} ${loan.status}`, inline: true },
            { name: '💵 Số Tiền Vay', value: formatCurrency(loan.amount), inline: true },
            { name: '📈 Lãi Suất', value: `${loan.interestRate}%/ngày`, inline: true },
            { name: '⏰ Thời Hạn', value: `${loan.duration} ngày`, inline: true },
            { name: '💰 Tổng Phải Trả', value: formatCurrency(loan.totalRepayment), inline: true },
            { name: '💸 Đã Trả', value: formatCurrency(loan.paidAmount), inline: true },
            { name: '💵 Còn Lại', value: formatCurrency(loan.remainingAmount), inline: true },
            { name: '📅 Ngày Tạo', value: `<t:${Math.floor(loan.createdAt.getTime() / 1000)}:F>`, inline: false },
            { name: '📅 Hạn Trả', value: `<t:${Math.floor(loan.dueDate.getTime() / 1000)}:F>`, inline: false }
        )
        .setTimestamp();
    
    if (isOverdue) {
        embed.addFields({ name: '⚠️ Cảnh Báo', value: 'Khoản vay đã quá hạn!', inline: false });
    }
    
    if (loan.payments.length > 0) {
        const recentPayments = loan.payments.slice(-3).map(payment => 
            `${formatCurrency(payment.amount)} - <t:${Math.floor(payment.timestamp.getTime() / 1000)}:R>`
        ).join('\n');
        embed.addFields({ name: '💸 Thanh Toán Gần Đây', value: recentPayments, inline: false });
    }
    
    await interaction.reply({ embeds: [embed] });
}

// Add autocomplete handler for loan command
export async function autocomplete(interaction) {
  try {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name === 'loan_id') {
      const userId = interaction.user.id;
      const guildId = interaction.guildId;
      
      // Get user's active loans
      const user = await User.findOne({ userId, guildId });
      if (!user || !user.loans || user.loans.length === 0) {
        return await interaction.respond([
          { name: 'Bạn không có khoản vay nào', value: 'no_loans' }
        ]);
      }
      
      // Filter active loans
      const activeLoans = user.loans.filter(loan => !loan.isPaid);
      
      if (activeLoans.length === 0) {
        return await interaction.respond([
          { name: 'Không có khoản vay đang hoạt động', value: 'no_active_loans' }
        ]);
      }
      
      // Create choices from active loans
      const choices = activeLoans.map((loan, index) => {
        const loanId = loan._id || loan.id || index;
        const amount = formatCurrency(loan.amount);
        const interest = formatCurrency(loan.totalOwed);
        const daysLeft = Math.max(0, Math.ceil((loan.dueDate - new Date()) / (1000 * 60 * 60 * 24)));
        
        return {
          name: `ID: ${loanId.toString().slice(-6)} | Gốc: ${amount} | Nợ: ${interest} | Còn: ${daysLeft} ngày`,
          value: loanId.toString()
        };
      }).slice(0, 25); // Discord autocomplete limit
      
      const filtered = choices.filter(choice => 
        choice.name.toLowerCase().includes(focusedOption.value.toLowerCase()) ||
        choice.value.includes(focusedOption.value)
      );
      
      await interaction.respond(filtered.slice(0, 25));
    }
  } catch (error) {
    console.error('Loan autocomplete error:', error);
    await interaction.respond([
      { name: 'Có lỗi xảy ra khi tải danh sách vay', value: 'error' }
    ]);
  }
}

// Helper functions
function getTypeTitle(type) {
    const titles = {
        lending: 'Tôi Cho Vay',
        borrowing: 'Tôi Đi Vay',
        pending: 'Chờ Phê Duyệt',
        active: 'Đang Hoạt Động'
    };
    return titles[type] || 'Tất Cả';
}

function getStatusEmoji(status) {
    const emojis = {
        pending: '⏳',
        active: '✅',
        completed: '🎉',
        defaulted: '❌',
        cancelled: '🚫'
    };
    return emojis[status] || '❓';
}