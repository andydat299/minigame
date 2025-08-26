import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import User from '../models/User.mjs';
import { formatCurrency } from './util.mjs';

export const data = new SlashCommandBuilder()
  .setName('loanrepay')
  .setDescription('Trả nợ khoản vay với autocomplete')
  .addStringOption(option =>
    option
      .setName('loan_id')
      .setDescription('Chọn khoản vay cần trả')
      .setRequired(true)
      .setAutocomplete(true)
  );

export async function autocomplete(interaction) {
  try {
    const focusedValue = interaction.options.getFocused();
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
      const loanId = loan._id?.toString().slice(-6) || `L${index + 1}`;
      const amount = formatCurrency(loan.amount);
      const debt = formatCurrency(loan.totalOwed);
      const daysLeft = Math.max(0, Math.ceil((loan.dueDate - new Date()) / (1000 * 60 * 60 * 24)));
      
      return {
        name: `ID: ${loanId} | Gốc: ${amount} | Nợ: ${debt} | Còn: ${daysLeft} ngày`,
        value: loan._id?.toString() || `index_${index}`
      };
    }).slice(0, 25); // Discord limit
    
    // Filter based on user input
    const filtered = choices.filter(choice => 
      choice.name.toLowerCase().includes(focusedValue.toLowerCase()) ||
      choice.value.includes(focusedValue)
    );
    
    await interaction.respond(filtered.slice(0, 25));
    
  } catch (error) {
    console.error('Loan autocomplete error:', error);
    await interaction.respond([
      { name: 'Có lỗi xảy ra khi tải danh sách', value: 'error' }
    ]);
  }
}

export async function execute(interaction) {
  try {
    await interaction.deferReply();
    
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const loanId = interaction.options.getString('loan_id');
    
    if (loanId === 'no_loans' || loanId === 'no_active_loans' || loanId === 'error') {
      return interaction.editReply('❌ Bạn không có khoản vay nào để trả!');
    }

    let user = await User.findOne({ userId, guildId });
    if (!user) {
      return interaction.editReply('❌ Bạn chưa có tài khoản!');
    }

    if (!user.loans || user.loans.length === 0) {
      return interaction.editReply('❌ Bạn không có khoản vay nào!');
    }

    // Find loan by ID
    let loan = null;
    let loanIndex = -1;

    if (loanId.startsWith('index_')) {
      // Handle index-based ID
      loanIndex = parseInt(loanId.replace('index_', ''));
      loan = user.loans[loanIndex];
    } else {
      // Find by MongoDB _id
      loanIndex = user.loans.findIndex(l => l._id?.toString() === loanId);
      loan = loanIndex >= 0 ? user.loans[loanIndex] : null;
    }

    if (!loan) {
      return interaction.editReply('❌ Không tìm thấy khoản vay với ID này!');
    }

    if (loan.isPaid) {
      return interaction.editReply('❌ Khoản vay này đã được trả rồi!');
    }

    if (user.coins < loan.totalOwed) {
      const embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('❌ Không Đủ Tiền')
        .setDescription(`Bạn cần **${formatCurrency(loan.totalOwed)}** để trả khoản vay này!`)
        .addFields([
          {
            name: '💰 Số dư hiện tại',
            value: formatCurrency(user.coins),
            inline: true
          },
          {
            name: '💸 Số tiền thiếu',
            value: formatCurrency(loan.totalOwed - user.coins),
            inline: true
          }
        ])
        .setTimestamp();
      
      return interaction.editReply({ embeds: [embed] });
    }

    // Process repayment
    user.coins -= loan.totalOwed;
    loan.isPaid = true;
    loan.paidDate = new Date();
    await user.save();

    const embed = new EmbedBuilder()
      .setColor('#27ae60')
      .setTitle('✅ Trả Nợ Thành Công!')
      .setDescription(`Bạn đã trả khoản vay thành công!`)
      .addFields([
        {
          name: '💰 Số tiền đã trả',
          value: formatCurrency(loan.totalOwed),
          inline: true
        },
        {
          name: '💎 Số dư còn lại',
          value: formatCurrency(user.coins),
          inline: true
        },
        {
          name: '📅 Ngày trả',
          value: new Date().toLocaleDateString('vi-VN'),
          inline: true
        }
      ])
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Loan repay command error:', error);
    return interaction.editReply('❌ Có lỗi xảy ra khi trả nợ!');
  }
}