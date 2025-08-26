import { Client, GatewayIntentBits, Collection, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import mongoose from 'mongoose';
import chalk from 'chalk';
import { MONGO_URI, TOKEN } from './config.mjs';
import User from './models/User.mjs';
import Loan from './models/Loan.mjs';
import Relationship from './models/Relationship.mjs';
import ProfileTheme from './models/ProfileTheme.mjs';
import TaiXiuGame from './models/TaiXiuGame.mjs';
import TaiXiuBet from './models/TaiXiuBet.mjs';
import { formatCurrency } from './commands/util.mjs';
import { initializeGiftcodeCleanup } from './utils/giftcodeManager.mjs';
import * as fish from './commands/fish.mjs';
import * as inventory from './commands/inventory.mjs';
import * as sellall from './commands/sellall.mjs';
import * as profile from './commands/profile.mjs';
import * as upgrade from './commands/upgrade.mjs';
import * as leaderboard from './commands/leaderboard.mjs';
import * as addcash from './commands/addcash.mjs';
import * as shop from './commands/shop.mjs';
import * as give from './commands/give.mjs';
import * as stats from './commands/stats.mjs';
import * as use from './commands/use.mjs';
import * as effects from './commands/effects.mjs';
import * as boss from './commands/boss.mjs';
import * as fishingevent from './commands/fishingevent.mjs';
import * as ban from './commands/ban-new.mjs';
import * as repair from './commands/repair.mjs';
import * as daily from './commands/daily.mjs';
import * as casino from './commands/casino.mjs';
import * as achievements from './commands/achievements.mjs';
import * as auction from './commands/quest.mjs';
import * as quest from './commands/quest.mjs';
import * as loan from './commands/loan.mjs';
import * as credit from './commands/credit.mjs';
import * as relationship from './commands/relationship.mjs';
import * as blackjack from './commands/blackjack.mjs';
import * as theme from './commands/theme.mjs';
import * as taixiu from './commands/taixiu.mjs';
import GuildConfig from './models/GuildConfig.mjs';
import { initEventScheduler } from './commands/fishingevent.mjs';
import { initializeQuests } from './game/questManager.mjs';
import { initLoanChecker } from './game/loanManager.mjs';
import { checkBanStatus } from './middleware/banCheck.mjs';
import AntiRaidManager from './managers/antiRaidManager.mjs';
import * as antiraid from './commands/antiraid.mjs';
import * as globalbalance from './commands/globalbalance.mjs';
import * as migrate from './commands/migrate.mjs';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const modules = [
  fish, inventory, sellall, profile, upgrade, leaderboard, addcash, shop, give, stats, use, effects, boss, 
  fishingevent, ban, repair, daily, casino, achievements, auction, quest, loan, credit,
  relationship, blackjack, theme, taixiu, antiraid, globalbalance, migrate
];
const commandMap = new Collection(); 
for (const m of modules) commandMap.set(m.data.name, m);

client.once(Events.ClientReady, async (c)=>{
  console.log(chalk.green(`[ready] Logged in as ${c.user.tag}`));
  try { await mongoose.connect(MONGO_URI); console.log(chalk.cyan(`[db] Connected to MongoDB`)); } catch (err) { console.error(chalk.red(`[db] error`), err); process.exit(1); }
  // Boss scheduler: check every 30s VN hour windows
  setInterval(async ()=>{
    try {
      const guilds = await GuildConfig.find({});
      const now = new Date();
      const vn = new Date(Date.now() + 7*60*60*1000);
      const curHour = vn.getUTCHours();
      for (const g of guilds){
        if (!g.bossHours || g.bossHours.length===0) continue;
        const active = g.bossActiveUntil && g.bossActiveUntil > now;
        const inHour = g.bossHours.includes(curHour);
        if (inHour && !active){ g.bossActiveUntil = new Date(now.getTime() + (g.bossDurationMin||15)*60*1000); await g.save(); }
        if (!inHour && active && g.bossActiveUntil < now){ g.bossActiveUntil = null; await g.save(); }
      }
    } catch (e) { console.error('[scheduler]', e); }
  }, 30_000);
  // Initialize quest system and event scheduler
await initializeQuests();
initEventScheduler();
  // Initialize giftcode system
  initializeGiftcodeCleanup();
  
  // Initialize TaiXiu game manager
  try {
    const TaiXiuGameManager = (await import('./game/taiXiuManager.mjs')).default;
    global.taiXiuManager = new TaiXiuGameManager(client);
    await global.taiXiuManager.initializeAllGames();
    console.log('🎲 TaiXiu Game Manager initialized');
  } catch (error) {
    console.error('Error initializing TaiXiu Game Manager:', error);
  }

  // Initialize AntiRaid Manager
  const antiRaidManager = new AntiRaidManager(client);
});

client.on(Events.InteractionCreate, async (interaction)=>{
  if (interaction.isChatInputCommand()) {
    // Check if user is banned (except for ban command itself)
    if (interaction.commandName !== 'ban') {
        const isBanned = await checkBanStatus(interaction);
        if (isBanned) return; // Stop execution if user is banned
    }

    const cmd = commandMap.get(interaction.commandName);
    if (!cmd) { await interaction.reply({ ephemeral:true, content:"Lệnh không tồn tại." }); return; }
    try { await cmd.execute(interaction); } catch (err) {
      console.error(err);
      if (interaction.deferred||interaction.replied) await interaction.followUp({ ephemeral:true, content:"Đã có lỗi xảy ra." });
      else await interaction.reply({ ephemeral:true, content:"Đã có lỗi xảy ra." });
    }
  } else if (interaction.isButton()) {
    // Handle button interactions
    await handleButtonInteraction(interaction);
  } else if (interaction.isModalSubmit()) {
    // Handle modal submissions
    await handleModalSubmit(interaction);
  }
});

client.login(TOKEN);

// Process error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle button interactions
async function handleButtonInteraction(interaction) {
  try {
    const customId = interaction.customId;
    
    if (customId.startsWith('loan_accept_')) {
      await handleLoanAccept(interaction);
    } else if (customId.startsWith('loan_decline_')) {
      await handleLoanDecline(interaction);
    } else if (customId.startsWith('loan_approve_')) {
      await handleLoanApprove(interaction);
    } else if (customId.startsWith('marry_accept_')) {
      await handleMarryAccept(interaction);
    } else if (customId.startsWith('marry_decline_')) {
      await handleMarryDecline(interaction);
    } else if (customId.startsWith('friend_accept_')) {
      await handleFriendAccept(interaction);
    } else if (customId.startsWith('friend_decline_')) {
      await handleFriendDecline(interaction);
    } else if (customId.startsWith('mentor_accept_')) {
      await handleMentorAccept(interaction);
    } else if (customId.startsWith('mentor_decline_')) {
      await handleMentorDecline(interaction);
    } else if (customId.startsWith('rival_accept_')) {
      await handleRivalAccept(interaction);
    } else if (customId.startsWith('rival_decline_')) {
      await handleRivalDecline(interaction);
    } else if (customId.startsWith('bj_')) {
      await handleBlackjackAction(interaction);
    } else if (customId.startsWith('theme_')) {
      await handleThemeAction(interaction);
    } else if (customId.startsWith('mood_')) {
      await handleMoodSelection(interaction);
    } else if (customId.startsWith('tx_')) {
      await handleTaiXiuAction(interaction);
    } else if (customId.startsWith('quickbet_')) {
      await handleQuickBet(interaction);
    } else if (customId === 'tx_play_custom') {
      await handleTaiXiuCustomPlay(interaction);
    } else if (customId === 'taixiu_analysis') {
      await handleTaiXiuAnalysis(interaction);
    } else if (customId === 'taixiu_custom') {
      await handleTaiXiuCustomPlay(interaction);
    } else if (customId === 'quick_giftcode') {
      await handleQuickGiftcode(interaction);
    } else if (customId === 'fish_cast') {
      await handleFishCast(interaction);
    } else if (customId === 'fish_inventory') {
      await handleFishInventory(interaction);
    } else if (customId === 'fish_repair') {
      await handleFishRepair(interaction);
    }
  } catch (error) {
    console.error('Button interaction error:', error);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Có lỗi xảy ra!', ephemeral: true });
      } else if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({ content: 'Có lỗi xảy ra!' });
      }
    } catch (replyError) {
      console.error('Error replying to interaction:', replyError);
      // Don't throw here to prevent uncaught exceptions
    }
  }
}

// Loan button handlers
async function handleLoanAccept(interaction) {
  const loanId = interaction.customId.replace('loan_accept_', '');
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  
  const loan = await Loan.findOne({ loanId, guildId, status: 'pending' });
  if (!loan) {
    return interaction.reply({ content: 'Khoản vay không tồn tại hoặc đã được xử lý!', ephemeral: true });
  }
  
  if (loan.borrowerId !== userId) {
    return interaction.reply({ content: 'Chỉ người vay mới có thể chấp nhận!', ephemeral: true });
  }
  
  // Process loan acceptance
  let lenderProfile = await User.findOne({ userId: loan.lenderId, guildId });
  if (!lenderProfile || (lenderProfile.coins || 0) < loan.amount) {
    return interaction.reply({ content: 'Người cho vay không đủ tiền!', ephemeral: true });
  }
  
  let borrowerProfile = await User.findOne({ userId: loan.borrowerId, guildId });
  if (!borrowerProfile) borrowerProfile = await User.create({ userId: loan.borrowerId, guildId });
  
  // Transfer money
  lenderProfile.coins = (lenderProfile.coins || 0) - loan.amount;
  borrowerProfile.coins = (borrowerProfile.coins || 0) + loan.amount;
  
  loan.status = 'active';
  loan.approvedAt = new Date();
  
  await lenderProfile.save();
  await borrowerProfile.save();
  await loan.save();
  
  // Create new embed for success message
  const successEmbed = new EmbedBuilder()
    .setColor('#00ff00')
    .setTitle('✅ Khoản Vay Đã Được Chấp Nhận')
    .setDescription(`<@${loan.lenderId}> và <@${loan.borrowerId}> đã hoàn thành giao dịch!`)
    .addFields(
      { name: '💵 Số Tiền Vay', value: `${loan.amount.toLocaleString()} xu`, inline: true },
      { name: '💰 Tổng Phải Trả', value: `${loan.totalRepayment.toLocaleString()} xu`, inline: true },
      { name: '📅 Hạn Trả', value: `<t:${Math.floor(loan.dueDate.getTime() / 1000)}:F>`, inline: true }
    )
    .setFooter({ text: 'Khoản vay đã được kích hoạt!' })
    .setTimestamp();
  
  await interaction.update({ embeds: [successEmbed], components: [] });
}

async function handleLoanDecline(interaction) {
  const loanId = interaction.customId.replace('loan_decline_', '');
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  
  const loan = await Loan.findOne({ loanId, guildId, status: 'pending' });
  if (!loan) {
    return interaction.reply({ content: 'Khoản vay không tồn tại hoặc đã được xử lý!', ephemeral: true });
  }
  
  if (loan.borrowerId !== userId && loan.lenderId !== userId) {
    return interaction.reply({ content: 'Bạn không có quyền từ chối khoản vay này!', ephemeral: true });
  }
  
  loan.status = 'cancelled';
  await loan.save();
  
  // Create new embed for decline message
  const declineEmbed = new EmbedBuilder()
    .setColor('#ff6b6b')
    .setTitle('❌ Khoản Vay Đã Bị Từ Chối')
    .setDescription('Khoản vay đã bị hủy bởi một trong hai bên.')
    .setFooter({ text: 'Giao dịch đã kết thúc!' })
    .setTimestamp();
  
  await interaction.update({ embeds: [declineEmbed], components: [] });
}

async function handleLoanApprove(interaction) {
  const parts = interaction.customId.split('_');
  const loanId = parts[2];
  const interestRate = parseFloat(parts[3]);
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  
  const loan = await Loan.findOne({ loanId, guildId, status: 'pending' });
  if (!loan) {
    return interaction.reply({ content: 'Khoản vay không tồn tại hoặc đã được xử lý!', ephemeral: true });
  }
  
  if (loan.lenderId !== userId) {
    return interaction.reply({ content: 'Chỉ người cho vay mới có thể phê duyệt!', ephemeral: true });
  }
  
  // Update loan with interest rate
  const dailyInterest = (loan.amount * interestRate / 100);
  const totalInterest = dailyInterest * loan.duration;
  const totalRepayment = Math.ceil(loan.amount + totalInterest);
  
  loan.interestRate = interestRate;
  loan.totalRepayment = totalRepayment;
  loan.remainingAmount = totalRepayment;
  await loan.save();
  
  // Create new embed with updated terms
  const updatedEmbed = new EmbedBuilder()
    .setColor('#48dbfb')
    .setTitle('💰 Đề Nghị Cho Vay Đã Được Cập Nhật')
    .setDescription(`<@${loan.lenderId}> đã phê duyệt với lãi suất ${interestRate}%/ngày!`)
    .addFields(
      { name: '💵 Số Tiền Vay', value: `${loan.amount.toLocaleString()} xu`, inline: true },
      { name: '📈 Lãi Suất', value: `${interestRate}%/ngày`, inline: true },
      { name: '⏰ Thời Hạn', value: `${loan.duration} ngày`, inline: true },
      { name: '💰 Tổng Phải Trả', value: `${totalRepayment.toLocaleString()} xu`, inline: true },
      { name: '📅 Hạn Trả', value: `<t:${Math.floor(loan.dueDate.getTime() / 1000)}:F>`, inline: true }
    )
    .setFooter({ text: 'Người vay có thể chấp nhận hoặc từ chối đề nghị này' })
    .setTimestamp();
  
  const acceptButton = new ButtonBuilder()
    .setCustomId(`loan_accept_${loanId}`)
    .setLabel('✅ Chấp Nhận')
    .setStyle(ButtonStyle.Success);
  
  const declineButton = new ButtonBuilder()
    .setCustomId(`loan_decline_${loanId}`)
    .setLabel('❌ Từ Chối')
    .setStyle(ButtonStyle.Danger);
  
  const row = new ActionRowBuilder().addComponents(acceptButton, declineButton);
  
  await interaction.update({ embeds: [updatedEmbed], components: [row] });
}

// Relationship button handlers
async function handleMarryAccept(interaction) {
  const relationshipId = interaction.customId.replace('marry_accept_', '');
  const userId = interaction.user.id;
  
  const relationship = await Relationship.findById(relationshipId);
  if (!relationship || relationship.status !== 'pending') {
    return interaction.reply({ content: 'Lời cầu hôn không tồn tại hoặc đã được xử lý!', ephemeral: true });
  }
  
  if (relationship.user2Id !== userId) {
    return interaction.reply({ content: 'Bạn không phải người được cầu hôn!', ephemeral: true });
  }
  
  relationship.status = 'accepted';
  relationship.marriageDate = new Date();
  await relationship.save();
  
  const successEmbed = new EmbedBuilder()
    .setColor('#ff69b4')
    .setTitle('💕 Kết Hôn Thành Công!')
    .setDescription(`<@${relationship.user1Id}> và <@${relationship.user2Id}> đã kết hôn! 🎉`)
    .addFields(
      { name: '💍 Ngày cưới', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      { name: '🎁 Bonus', value: '+10% xu khi cùng hoạt động', inline: true }
    )
    .setTimestamp();
  
  await interaction.update({ embeds: [successEmbed], components: [] });
}

async function handleMarryDecline(interaction) {
  const relationshipId = interaction.customId.replace('marry_decline_', '');
  const relationship = await Relationship.findById(relationshipId);
  
  if (relationship) {
    relationship.status = 'rejected';
    await relationship.save();
  }
  
  const declineEmbed = new EmbedBuilder()
    .setColor('#ff6b6b')
    .setTitle('💔 Lời Cầu Hôn Bị Từ Chối')
    .setDescription('Lời cầu hôn đã bị từ chối.')
    .setTimestamp();
  
  await interaction.update({ embeds: [declineEmbed], components: [] });
}

async function handleFriendAccept(interaction) {
  const relationshipId = interaction.customId.replace('friend_accept_', '');
  const relationship = await Relationship.findById(relationshipId);
  
  if (relationship) {
    relationship.status = 'accepted';
    await relationship.save();
  }
  
  const successEmbed = new EmbedBuilder()
    .setColor('#48dbfb')
    .setTitle('🤝 Kết Bạn Thành Công!')
    .setDescription(`<@${relationship.user1Id}> và <@${relationship.user2Id}> đã trở thành bạn bè!`)
    .setTimestamp();
  
  await interaction.update({ embeds: [successEmbed], components: [] });
}

async function handleFriendDecline(interaction) {
  const relationshipId = interaction.customId.replace('friend_decline_', '');
  const relationship = await Relationship.findById(relationshipId);
  
  if (relationship) {
    relationship.status = 'rejected';
    await relationship.save();
  }
  
  const declineEmbed = new EmbedBuilder()
    .setColor('#ff6b6b')
    .setTitle('❌ Từ Chối Kết Bạn')
    .setDescription('Lời mời kết bạn đã bị từ chối.')
    .setTimestamp();
  
  await interaction.update({ embeds: [declineEmbed], components: [] });
}

async function handleMentorAccept(interaction) {
  const relationshipId = interaction.customId.replace('mentor_accept_', '');
  const relationship = await Relationship.findById(relationshipId);
  
  if (relationship) {
    relationship.status = 'accepted';
    await relationship.save();
  }
  
  const successEmbed = new EmbedBuilder()
    .setColor('#feca57')
    .setTitle('🎓 Mentorship Thành Công!')
    .setDescription(`Mối quan hệ mentor-mentee đã được thiết lập!`)
    .setTimestamp();
  
  await interaction.update({ embeds: [successEmbed], components: [] });
}

async function handleMentorDecline(interaction) {
  const relationshipId = interaction.customId.replace('mentor_decline_', '');
  const relationship = await Relationship.findById(relationshipId);
  
  if (relationship) {
    relationship.status = 'rejected';
    await relationship.save();
  }
  
  const declineEmbed = new EmbedBuilder()
    .setColor('#ff6b6b')
    .setTitle('❌ Từ Chối Mentorship')
    .setDescription('Đề nghị mentorship đã bị từ chối.')
    .setTimestamp();
  
  await interaction.update({ embeds: [declineEmbed], components: [] });
}

async function handleRivalAccept(interaction) {
  const relationshipId = interaction.customId.replace('rival_accept_', '');
  const relationship = await Relationship.findById(relationshipId);
  
  if (relationship) {
    relationship.status = 'accepted';
    await relationship.save();
  }
  
  const successEmbed = new EmbedBuilder()
    .setColor('#ff6b6b')
    .setTitle('⚔️ Rivalry Thành Lập!')
    .setDescription(`Cuộc đối đầu đã bắt đầu! Ai sẽ là người chiến thắng?`)
    .setTimestamp();
  
  await interaction.update({ embeds: [successEmbed], components: [] });
}

async function handleRivalDecline(interaction) {
  const relationshipId = interaction.customId.replace('rival_decline_', '');
  const relationship = await Relationship.findById(relationshipId);
  
  if (relationship) {
    relationship.status = 'rejected';
    await relationship.save();
  }
  
  const declineEmbed = new EmbedBuilder()
    .setColor('#ff6b6b')
    .setTitle('🏳️ Từ Chối Thách Đấu')
    .setDescription('Thách đấu rivalry đã bị từ chối.')
    .setTimestamp();
  
  await interaction.update({ embeds: [declineEmbed], components: [] });
}

// Blackjack button handler
async function handleBlackjackAction(interaction) {
  const userId = interaction.user.id;
  const action = interaction.customId.split('_')[1]; // hit, stand, double
  
  const gameState = global.blackjackGames?.get(userId);
  if (!gameState) {
    return interaction.reply({ content: 'Game session đã hết hạn!', ephemeral: true });
  }
  
  const { calculateScore, formatCards, drawCard } = await import('./commands/blackjack.mjs');
  
  if (action === 'hit') {
    // Player hits
    const newCard = drawCard(gameState.deck);
    gameState.playerCards.push(newCard);
    const playerScore = calculateScore(gameState.playerCards);
    
    if (playerScore > 21) {
      // Bust
      const profile = await User.findOne({ userId: gameState.userId, guildId: gameState.guildId });
      profile.coins = (profile.coins || 0) - gameState.bet;
      await profile.save();
      
      const bustEmbed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('🃏 Blackjack - Bust!')
        .addFields(
          { name: '🎴 Bài của bạn', value: formatCards(gameState.playerCards) + ` = **${playerScore}** 💥`, inline: true },
          { name: '💰 Kết quả', value: `Bust! Mất ${formatCurrency(gameState.bet)}`, inline: false }
        )
        .setTimestamp();
      
      global.blackjackGames.delete(userId);
      await interaction.update({ embeds: [bustEmbed], components: [] });
    } else {
      // Continue game
      const dealerVisibleScore = calculateScore([gameState.dealerCards[0]]);
      
      const embed = new EmbedBuilder()
        .setColor('#48dbfb')
        .setTitle('🃏 Blackjack')
        .addFields(
          { name: '🎴 Bài của bạn', value: formatCards(gameState.playerCards) + ` = **${playerScore}**`, inline: true },
          { name: '🎭 Bài dealer', value: formatCards([gameState.dealerCards[0], '❓']) + ` = **${dealerVisibleScore}+**`, inline: true }
        )
        .setTimestamp();
      
      const hitButton = new ButtonBuilder()
        .setCustomId(`bj_hit_${Date.now()}`)
        .setLabel('🎯 Hit')
        .setStyle(ButtonStyle.Primary);
      
      const standButton = new ButtonBuilder()
        .setCustomId(`bj_stand_${Date.now()}`)
        .setLabel('🛑 Stand')
        .setStyle(ButtonStyle.Secondary);
      
      const row = new ActionRowBuilder().addComponents(hitButton, standButton);
      
      await interaction.update({ embeds: [embed], components: [row] });
    }
  } else if (action === 'stand') {
    // Dealer plays
    let dealerScore = calculateScore(gameState.dealerCards);
    while (dealerScore < 17) {
      gameState.dealerCards.push(drawCard(gameState.deck));
      dealerScore = calculateScore(gameState.dealerCards);
    }
    
    const playerScore = calculateScore(gameState.playerCards);
    const profile = await User.findOne({ userId: gameState.userId, guildId: gameState.guildId });
    
    let result = '';
    let color = '';
    
    if (dealerScore > 21) {
      // Dealer bust, player wins
      const winAmount = gameState.bet;
      profile.coins = (profile.coins || 0) + winAmount;
      result = `Dealer bust! Thắng ${formatCurrency(winAmount)}!`;
      color = '#00ff00';
    } else if (playerScore > dealerScore) {
      // Player wins
      const winAmount = gameState.bet;
      profile.coins = (profile.coins || 0) + winAmount;
      result = `Thắng! +${formatCurrency(winAmount)}`;
      color = '#00ff00';
    } else if (playerScore < dealerScore) {
      // Player loses
      profile.coins = (profile.coins || 0) - gameState.bet;
      result = `Thua! -${formatCurrency(gameState.bet)}`;
      color = '#ff6b6b';
    } else {
      // Tie
      result = 'Hòa! Tiền cược được hoàn lại.';
      color = '#feca57';
    }
    
    await profile.save();
    
    const finalEmbed = new EmbedBuilder()
      .setColor(color)
      .setTitle('🃏 Blackjack - Kết Quả')
      .addFields(
        { name: '🎴 Bài của bạn', value: formatCards(gameState.playerCards) + ` = **${playerScore}**`, inline: true },
        { name: '🎭 Bài dealer', value: formatCards(gameState.dealerCards) + ` = **${dealerScore}**`, inline: true },
        { name: '💰 Kết quả', value: result, inline: false }
      )
      .setTimestamp();
    
    global.blackjackGames.delete(userId);
    await interaction.update({ embeds: [finalEmbed], components: [] });
  }
}

// Theme button handler
async function handleThemeAction(interaction) {
  const action = interaction.customId.replace('theme_', '');
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  
  let profileTheme = await ProfileTheme.findOne({ userId, guildId });
  if (!profileTheme) {
    profileTheme = await ProfileTheme.create({
      userId,
      guildId,
      ownedThemes: ['default']
    });
  }
  
  if (action === 'status') {
    // Show modal for status change
    const modal = new ModalBuilder()
      .setCustomId('theme_status_modal')
      .setTitle('Đổi Status');
    
    const statusInput = new TextInputBuilder()
      .setCustomId('status_input')
      .setLabel('Status mới:')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(100)
      .setPlaceholder('Đang câu cá...')
      .setValue(profileTheme.showcase?.status || '');
    
    const firstActionRow = new ActionRowBuilder().addComponents(statusInput);
    modal.addComponents(firstActionRow);
    
    await interaction.showModal(modal);
  } else if (action === 'mood') {
    // Simple mood selection with buttons
    const embed = new EmbedBuilder()
      .setColor('#48dbfb')
      .setTitle('😊 Chọn Mood')
      .setDescription('Chọn mood hiện tại của bạn:');
    
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('mood_😊').setLabel('😊 Vui').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('mood_😎').setLabel('😎 Cool').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('mood_🤔').setLabel('🤔 Suy nghĩ').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('mood_😴').setLabel('😴 Buồn ngủ').setStyle(ButtonStyle.Primary)
    );
    
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('mood_🔥').setLabel('🔥 Nhiệt huyết').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('mood_💪').setLabel('💪 Mạnh mẽ').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('mood_🎣').setLabel('🎣 Câu cá').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('mood_💰').setLabel('💰 Giàu có').setStyle(ButtonStyle.Secondary)
    );
    
    await interaction.update({ embeds: [embed], components: [row1, row2] });
  } else if (action === 'quote') {
    // Show modal for quote change
    const modal = new ModalBuilder()
      .setCustomId('theme_quote_modal')
      .setTitle('Đổi Quote');
    
    const quoteInput = new TextInputBuilder()
      .setCustomId('quote_input')
      .setLabel('Quote mới:')
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(200)
      .setPlaceholder('Cuộc sống như câu cá, cần kiên nhẫn...')
      .setValue(profileTheme.showcase?.quote || '');
    
    const firstActionRow = new ActionRowBuilder().addComponents(quoteInput);
    modal.addComponents(firstActionRow);
    
    await interaction.showModal(modal);
  }
}

// Handle mood selection
async function handleMoodSelection(interaction) {
  const mood = interaction.customId.replace('mood_', '');
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  
  let profileTheme = await ProfileTheme.findOne({ userId, guildId });
  if (!profileTheme) {
    profileTheme = await ProfileTheme.create({ userId, guildId });
  }
  
  profileTheme.showcase.mood = mood;
  await profileTheme.save();
  
  const embed = new EmbedBuilder()
    .setColor('#00ff00')
    .setTitle('✅ Mood Đã Được Cập Nhật!')
    .setDescription(`Mood của bạn đã được đổi thành: ${mood}`)
    .setTimestamp();
  
  await interaction.update({ embeds: [embed], components: [] });
}

// Handle modal submissions
async function handleModalSubmit(interaction) {
  const modalId = interaction.customId;
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  
  // Handle theme modals
  if (modalId === 'theme_status_modal') {
    let profileTheme = await ProfileTheme.findOne({ userId, guildId });
    if (!profileTheme) {
      profileTheme = await ProfileTheme.create({ userId, guildId });
    }
    
    const newStatus = interaction.fields.getTextInputValue('status_input');
    profileTheme.showcase.status = newStatus;
    await profileTheme.save();
    
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('✅ Status Đã Được Cập Nhật!')
      .setDescription(`Status mới: "${newStatus}"`)
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } else if (modalId === 'theme_quote_modal') {
    let profileTheme = await ProfileTheme.findOne({ userId, guildId });
    if (!profileTheme) {
      profileTheme = await ProfileTheme.create({ userId, guildId });
    }
    
    const newQuote = interaction.fields.getTextInputValue('quote_input');
    profileTheme.showcase.quote = newQuote;
    await profileTheme.save();
    
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('✅ Quote Đã Được Cập Nhật!')
      .setDescription(`Quote mới: "${newQuote}"`)
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } else if (modalId === 'giftcode_modal') {
    await handleGiftcodeModal(interaction);
  } else if (modalId === 'taixiu_custom_modal') {
    try {
      // Defer reply to prevent timeout
      await interaction.deferReply({ ephemeral: true });
      
      const amount = parseInt(interaction.fields.getTextInputValue('bet_amount'));
      const choice = interaction.fields.getTextInputValue('bet_choice').toLowerCase().trim();
      
      // Validate input
      if (isNaN(amount) || amount < 100) {
        return await interaction.editReply({
          content: '❌ Số tiền phải là số và ít nhất 100!'
        });
      }

      if (choice !== 'tai' && choice !== 'xiu') {
        return await interaction.editReply({
          content: '❌ Chỉ được chọn "tai" hoặc "xiu"!'
        });
      }

      // Check if game manager exists
      if (!global.taiXiuManager) {
        return await interaction.editReply({
          content: '❌ Hệ thống tài xỉu chưa sẵn sàng!'
        });
      }

      // Check if game is active and in betting phase
      const gameData = await global.taiXiuManager.getGameData(guildId);
      if (!gameData || !gameData.isActive || !gameData.bettingPhase) {
        return await interaction.editReply({
          content: '❌ Không thể đặt cược lúc này! Game có thể đã kết thúc hoặc chưa bắt đầu.'
        });
      }

      // Place the bet using game manager
      await global.taiXiuManager.placeBet(guildId, userId, choice, amount);
      
      const choiceText = choice === 'tai' ? '🔴 TÀI' : '⚫ XỈU';
      
      await interaction.editReply({
        content: `✅ Đặt cược thành công!\n**${choiceText}** - **${formatCurrency(amount)}**`
      });
      
    } catch (error) {
      console.error('Modal submit error:', error);
      try {
        const errorMessage = error.message || 'Có lỗi xảy ra khi đặt cược!';
        if (interaction.deferred) {
          await interaction.editReply({
            content: `❌ ${errorMessage}`
          });
        } else {
          await interaction.reply({
            content: `❌ ${errorMessage}`,
            ephemeral: true
          });
        }
      } catch (replyError) {
        console.error('Error replying to modal:', replyError);
      }
    }
  }
}

// TaiXiu button handler
async function handleTaiXiuAction(interaction) {
  const customId = interaction.customId;
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  
  const { gameRooms, playerBets } = await import('./commands/taixiu.mjs');
  
  let profile = await User.findOne({ userId, guildId });
  if (!profile) profile = await User.create({ userId, guildId });
  
  const gameRoom = gameRooms.get(guildId);
  if (!gameRoom || gameRoom.status !== 'betting') {
    return interaction.reply({ 
      content: 'Không thể đặt cược lúc này!', 
      ephemeral: true 
    });
  }
  
  // Check if user already bet this round - use current round
  const betKey = `${guildId}_${userId}_${gameRoom.round}`;
  console.log(`Checking bet key: ${betKey}, Round: ${gameRoom.round}`);
  console.log(`PlayerBets size:`, playerBets.size);
  console.log(`PlayerBets has key:`, playerBets.has(betKey));
  
  if (playerBets.has(betKey)) {
    return interaction.reply({ 
      content: `Bạn đã đặt cược ván ${gameRoom.round} này rồi!`, 
      ephemeral: true 
    });
  }
  
  // Store user's current selection
  const userSelection = global.taixiuSelections?.get(userId) || {};
  
  if (customId.startsWith('tx_choice_')) {
    // Handle choice selection (TÀI/XỈU)
    const choice = customId.replace('tx_choice_', '');
    userSelection.choice = choice;
    
    if (!global.taixiuSelections) global.taixiuSelections = new Map();
    global.taixiuSelections.set(userId, userSelection);
    
    const embed = new EmbedBuilder()
      .setColor(choice === 'tai' ? '#ff6b6b' : '#2f3136')
      .setTitle('✅ Đã Chọn')
      .setDescription(`Bạn đã chọn: **${choice === 'tai' ? '🔴 TÀI (11-18)' : '⚫ XỈU (3-10)'}**\n\nBây giờ chọn số tiền cược:`)
      .setFooter({ text: 'Nhấn vào số tiền bên dưới để hoàn tất cược!' });
    
    await interaction.update({ embeds: [embed] });
    
  } else if (customId.startsWith('tx_amount_')) {
    // Handle amount selection
    if (!userSelection.choice) {
      return interaction.reply({ 
        content: 'Vui lòng chọn TÀI hoặc XỈU trước!', 
        ephemeral: true 
      });
    }
    
    let amount;
    if (customId === 'tx_amount_allin') {
      amount = profile.coins || 0;
    } else if (customId === 'tx_amount_custom') {
      // Show modal for custom amount
      const modal = new ModalBuilder()
        .setCustomId('tx_custom_amount')
        .setTitle('Nhập Số Tiền Cược');
      
      const amountInput = new TextInputBuilder()
        .setCustomId('amount_input')
        .setLabel('Số tiền cược:')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ví dụ: 5000')
        .setMinLength(2)
        .setMaxLength(10);
      
      const firstActionRow = new ActionRowBuilder().addComponents(amountInput);
      modal.addComponents(firstActionRow);
      
      return interaction.showModal(modal);
    } else {
      amount = parseInt(customId.replace('tx_amount_', ''));
    }
    
    if ((profile.coins || 0) < amount) {
      return interaction.reply({ 
        content: `Bạn không đủ tiền để cược ${formatCurrency(amount)}!`, 
        ephemeral: true 
      });
    }
    
    if (amount < 100) {
      return interaction.reply({ 
        content: 'Số tiền cược tối thiểu là 100 xu!', 
        ephemeral: true 
      });
    }
    
    // Place bet
    const bet = {
      userId,
      username: interaction.user.username,
      choice: userSelection.choice,
      amount,
      round: gameRoom.round
    };
    
    playerBets.set(betKey, bet);
    gameRoom.bets.push(bet);
    gameRoom.totalPool += amount;
    
    // Deduct money
    profile.coins = (profile.coins || 0) - amount;
    await profile.save();
    
    // Clean up selection
    global.taixiuSelections?.delete(userId);
    
    const timeLeft = Math.max(0, Math.ceil((gameRoom.endTime - Date.now()) / 1000));
    
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('🎉 Đặt Cược Thành Công!')
      .addFields(
        { name: '🎯 Lựa chọn', value: userSelection.choice === 'tai' ? '🔴 TÀI (11-18)' : '⚫ XỈU (3-10)', inline: true },
        { name: '💰 Số tiền cược', value: formatCurrency(amount), inline: true },
        { name: '🏆 Tổng pool', value: formatCurrency(gameRoom.totalPool), inline: true },
        { name: '⏰ Thời gian còn lại', value: `${timeLeft}s`, inline: true },
        { name: '👥 Số người cược', value: `${gameRoom.bets.length}`, inline: true },
        { name: '💳 Số dư còn lại', value: formatCurrency(profile.coins), inline: true }
      )
      .setFooter({ text: 'Chúc bạn may mắn! 🍀' })
      .setTimestamp();
    
    await interaction.update({ embeds: [embed], components: [] });
  }
}

// Unified tài xỉu actions handler
async function handleTaiXiuActions(interaction) {
  const customId = interaction.customId;
  
  if (customId === 'taixiu_analysis') {
    await handleTaiXiuAnalysis(interaction);
  } else if (customId === 'taixiu_custom') {
    await handleTaiXiuCustomPlay(interaction);
  } else if (customId.startsWith('quickbet_')) {
    await handleQuickBet(interaction);
  } else if (customId.startsWith('tx_choice_') || customId.startsWith('tx_amount_')) {
    await handleTaiXiuCustomOptions(interaction);
  } else if (customId.startsWith('final_bet_')) {
    await handleFinalBet(interaction);
  } else if (customId.startsWith('tx_')) {
    await handleTaiXiuAction(interaction);
  }
}

// Handle custom betting options (choice and amount buttons)
async function handleTaiXiuCustomOptions(interaction) {
  // Store user choice/amount temporarily
  const userId = interaction.user.id;
  const customId = interaction.customId;
  
  if (customId.startsWith('tx_choice_')) {
    const choice = customId.split('_')[2]; // 'tai' or 'xiu'
    // Store choice temporarily (you can use a Map for this)
    await interaction.reply({
      content: `✅ Đã chọn **${choice.toUpperCase()}**! Bây giờ chọn số tiền cược.`,
      ephemeral: true
    });
  } else if (customId.startsWith('tx_amount_')) {
    const amount = customId.split('_')[2]; // amount or 'allin' or 'custom'
    
    if (amount === 'custom') {
      // Show modal for custom amount
      await showCustomAmountModal(interaction);
    } else if (amount === 'allin') {
      // Handle all-in bet
      await interaction.reply({
        content: '🔥 ALL IN được chọn! Vui lòng chọn TÀI hoặc XỈU trước.',
        ephemeral: true
      });
    } else {
      // Handle numeric amount
      await interaction.reply({
        content: `💰 Đã chọn ${formatCurrency(parseInt(amount))}! Vui lòng chọn TÀI hoặc XỈU trước.`,
        ephemeral: true
      });
    }
  }
}

// Show custom amount modal
async function showCustomAmountModal(interaction) {
  const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
  
  const modal = new ModalBuilder()
    .setCustomId('tx_custom_amount_modal')
    .setTitle('💰 Nhập Số Tiền Cược');
  
  const amountInput = new TextInputBuilder()
    .setCustomId('custom_amount_input')
    .setLabel('Số tiền cược')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ví dụ: 50000')
    .setRequired(true)
    .setMaxLength(10);
  
  const actionRow = new ActionRowBuilder().addComponents(amountInput);
  modal.addComponents(actionRow);
  
  await interaction.showModal(modal);
}

// Handle quick bet buttons
async function handleQuickBet(interaction) {
  const customId = interaction.customId;
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  
  try {
    // Defer reply to prevent timeout
    await interaction.deferReply({ ephemeral: true });
    
    // Parse quick bet: quickbet_tai_1000 or quickbet_xiu_1000
    const parts = customId.split('_');
    const choice = parts[1]; // 'tai' or 'xiu'
    const amount = parseInt(parts[2]); // amount
    
    if (!global.taiXiuManager) {
      return await interaction.editReply({ 
        content: 'Hệ thống tài xỉu chưa sẵn sàng!' 
      });
    }
    
    // Place bet using game manager
    await global.taiXiuManager.placeBet(guildId, userId, choice, amount);
    
    const choiceText = choice === 'tai' ? '🔴 TÀI' : '⚫ XỈU';
    await interaction.editReply({ 
      content: `✅ Đã đặt cược **${choiceText}** với số tiền **${formatCurrency(amount)}**!`
    });
    
  } catch (error) {
    console.error('Quick bet error:', error);
    try {
      if (interaction.deferred) {
        await interaction.editReply({ 
          content: error.message || 'Có lỗi xảy ra khi đặt cược!'
        });
      } else {
        await interaction.reply({ 
          content: error.message || 'Có lỗi xảy ra khi đặt cược!', 
          ephemeral: true 
        });
      }
    } catch (replyError) {
      console.error('Error replying to interaction:', replyError);
    }
  }
}

// Handle quick giftcode button
async function handleQuickGiftcode(interaction) {
  const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
  
  const modal = new ModalBuilder()
    .setCustomId('giftcode_modal')
    .setTitle('🎁 Nhập Giftcode');
  
  const codeInput = new TextInputBuilder()
    .setCustomId('giftcode_input')
    .setLabel('Mã Giftcode')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Nhập mã giftcode ở đây...')
    .setRequired(true)
    .setMaxLength(20);
  
  const actionRow = new ActionRowBuilder().addComponents(codeInput);
  modal.addComponents(actionRow);
  
  await interaction.showModal(modal);
}

// Handle giftcode modal submission
async function handleGiftcodeModal(interaction) {
  const code = interaction.fields.getTextInputValue('giftcode_input').toUpperCase();
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  
  const Giftcode = (await import('./models/Giftcode.mjs')).default;
  const User = (await import('./models/User.mjs')).default;
  
  // Find giftcode
  const giftcode = await Giftcode.findOne({ code, guildId, isActive: true });
  if (!giftcode) {
    return interaction.reply({
      content: '❌ Giftcode không tồn tại hoặc đã hết hạn!',
      ephemeral: true
    });
  }
  
  // Check expiration
  if (giftcode.expiresAt && giftcode.expiresAt < new Date()) {
    giftcode.isActive = false;
    await giftcode.save();
    return interaction.reply({
      content: '⏰ Giftcode đã hết hạn!',
      ephemeral: true
    });
  }
  
  // Check max uses
  if (giftcode.maxUses !== -1 && giftcode.currentUses >= giftcode.maxUses) {
    return interaction.reply({
      content: '🚫 Giftcode đã hết lượt sử dụng!',
      ephemeral: true
    });
  }
  
  // Check if user already used
  if (giftcode.oneTimePerUser && giftcode.usedBy.includes(userId)) {
    return interaction.reply({
      content: '🔄 Bạn đã sử dụng giftcode này rồi!',
      ephemeral: true
    });
  }
  
  // Get or create user profile
  let profile = await User.findOne({ userId, guildId });
  if (!profile) {
    profile = await User.create({ userId, guildId });
  }
  
  // Apply rewards
  const rewards = [];
  
  if (giftcode.rewards.coins > 0) {
    profile.coins = (profile.coins || 0) + giftcode.rewards.coins;
    rewards.push(`💰 ${formatCurrency(giftcode.rewards.coins)}`);
  }
  
  if (giftcode.rewards.bait > 0) {
    profile.bait = (profile.bait || 0) + giftcode.rewards.bait;
    rewards.push(`🪱 ${giftcode.rewards.bait} mồi`);
  }
  
  if (giftcode.rewards.freeFishingTries > 0) {
    profile.freeFishingTries = (profile.freeFishingTries || 0) + giftcode.rewards.freeFishingTries;
    rewards.push(`🎁 ${giftcode.rewards.freeFishingTries} lần câu miễn phí`);
  }
  
  await profile.save();
  
  // Update giftcode usage
  giftcode.currentUses += 1;
  giftcode.usedBy.push(userId);
  await giftcode.save();
  
  const { EmbedBuilder } = await import('discord.js');
  const embed = new EmbedBuilder()
    .setColor('#00ff00')
    .setTitle('🎉 Giftcode Thành Công!')
    .setDescription(`**Mã: \`${code}\`**\n${giftcode.description || 'Chúc mừng bạn!'}`)
    .addFields({ 
      name: '🎁 Phần thưởng', 
      value: rewards.join('\n') || 'Không có', 
      inline: false 
    })
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// Handle Tai Xiu custom play
async function handleTaiXiuCustomPlay(interaction) {
  try {
    const guildId = interaction.guild.id;
    
    // Check if game manager exists
    if (!global.taiXiuManager) {
      return await interaction.reply({
        content: '❌ Hệ thống tài xỉu chưa sẵn sàng!',
        ephemeral: true
      });
    }
    
    const gameData = await global.taiXiuManager.getGameData(guildId);
    
    if (!gameData || !gameData.isActive) {
      return await interaction.reply({
        content: '❌ Chưa có game tài xỉu nào đang hoạt động! Sử dụng `/taixiu start` để bắt đầu.',
        ephemeral: true
      });
    }
    
    if (!gameData.bettingPhase) {
      return await interaction.reply({
        content: '❌ Hiện tại không thể đặt cược! Game có thể đang xử lý kết quả.',
        ephemeral: true
      });
    }

    // Create modal for custom bet
    const modal = new ModalBuilder()
      .setCustomId('taixiu_custom_modal')
      .setTitle('🎯 Đặt Cược Tùy Chỉnh');

    const amountInput = new TextInputBuilder()
      .setCustomId('bet_amount')
      .setLabel('Số tiền muốn đặt cược')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Nhập số tiền (ít nhất 100)')
      .setMinLength(3)
      .setMaxLength(10)
      .setRequired(true);

    const choiceInput = new TextInputBuilder()
      .setCustomId('bet_choice')
      .setLabel('Chọn TÀI hoặc XỈU')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Nhập: tai hoặc xiu')
      .setMinLength(3)
      .setMaxLength(3)
      .setRequired(true);

    const firstRow = new ActionRowBuilder().addComponents(amountInput);
    const secondRow = new ActionRowBuilder().addComponents(choiceInput);

    modal.addComponents(firstRow, secondRow);

    await interaction.showModal(modal);
  } catch (error) {
    console.error('TaiXiu custom play error:', error);
    await interaction.reply({
      content: '❌ Có lỗi xảy ra khi xử lý yêu cầu!',
      ephemeral: true
    });
  }
}

// Handle TaiXiu analysis
async function handleTaiXiuAnalysis(interaction) {
  try {
    const guildId = interaction.guild.id;
    const gameData = await global.taiXiuManager.getGameData(guildId);
    
    if (!gameData) {
      return await interaction.reply({
        content: '❌ Chưa có game tài xỉu nào được khởi tạo!',
        ephemeral: true
      });
    }

    let analysisText = '📊 **PHÂN TÍCH LỊCH SỬ 10 VÁN GẦN NHẤT**\n\n';
    
    if (!gameData.history || gameData.history.length === 0) {
      analysisText += '❌ Chưa có dữ liệu lịch sử!';
    } else {
      const recentHistory = gameData.history.slice(-10).reverse();
      const diceEmojis = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      
      recentHistory.forEach((game, index) => {
        const dice = game.dice.map(d => diceEmojis[d]).join(' ');
        const resultIcon = game.result === 'tai' ? '🔴' : '⚫';
        const resultText = game.result === 'tai' ? 'TÀI' : 'XỈU';
        analysisText += `**${game.round}:** ${dice} = ${game.total} ${resultIcon} ${resultText}\n`;
      });

      // Thống kê
      const taiCount = recentHistory.filter(g => g.result === 'tai').length;
      const xiuCount = recentHistory.filter(g => g.result === 'xiu').length;
      
      analysisText += `\n📈 **THỐNG KÊ:**\n`;
      analysisText += `🔴 TÀI: ${taiCount}/${recentHistory.length} (${((taiCount/recentHistory.length)*100).toFixed(1)}%)\n`;
      analysisText += `⚫ XỈU: ${xiuCount}/${recentHistory.length} (${((xiuCount/recentHistory.length)*100).toFixed(1)}%)\n`;
      
      // Dự đoán đơn giản
      const lastResult = recentHistory[0]?.result;
      const trend = lastResult === 'tai' ? 'Có thể sẽ ra XỈU' : 'Có thể sẽ ra TÀI';
      analysisText += `\n🔮 **DỰ ĐOÁN:** ${trend} (chỉ tham khảo)`;
    }

    const embed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setTitle('🔮 SOI CẦU TÀI XỈU')
      .setDescription(analysisText)
      .setFooter({ text: 'Lưu ý: Đây chỉ là phân tích thống kê, không đảm bảo độ chính xác!' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error('TaiXiu analysis error:', error);
    await interaction.reply({
      content: '❌ Có lỗi xảy ra khi phân tích!',
      ephemeral: true
    });
  }
}

// AntiRaid event handlers
client.on('guildMemberAdd', async (member) => {
  console.log(`New member joined: ${member.user.tag} in ${member.guild.name}`);
  
  // AntiRaid check for join spam
  try {
    await antiRaidManager.checkJoinSpam(member);
  } catch (error) {
    console.error('AntiRaid join check error:', error);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  
  // AntiRaid check for message spam
  try {
    await antiRaidManager.checkMessageSpam(message);
  } catch (error) {
    console.error('AntiRaid message check error:', error);
  }
});

// Handler cho thả cần câu
async function handleFishCast(interaction) {
  try {
    await interaction.deferReply();
    
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    let user = await User.findOne({ userId, guildId });
    
    if (!user) {
      user = await User.create({ userId, guildId });
    }

    const { getRodInfo, performFishing, updateUserStats, formatCurrency } = await import('./commands/fish.mjs');
    
    const rodInfo = getRodInfo(user);
    if (!rodInfo.hasRod || rodInfo.durability <= 0) {
      return interaction.editReply('❌ Cần câu của bạn đã hỏng hoặc không tồn tại! Hãy sửa chữa hoặc mua cần mới.');
    }
    
    // Animation câu cá
    const castingEmbed = new EmbedBuilder()
      .setColor('#74b9ff')
      .setTitle('🎣 Đang Thả Cần...')
      .setDescription('*Bạn đang thả cần xuống nước...*\n\n🌊 ～～～ 🎣 ～～～ 🌊\n\n⏳ Chờ cá cắn câu...')
      .setTimestamp();
        
    await interaction.editReply({ embeds: [castingEmbed] });
    
    // Chờ 2-3 giây để tạo hồi hộp
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // Thực hiện câu cá
    const resultEmbed = await performFishing(user, rodInfo);
    await updateUserStats(user, rodInfo);
    
    return interaction.editReply({ embeds: [resultEmbed] });
    
  } catch (error) {
    console.error('Fish cast error:', error);
    return interaction.editReply('❌ Có lỗi xảy ra khi câu cá!');
  }
}

// Handler cho inventory
async function handleFishInventory(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    let user = await User.findOne({ userId, guildId });
    
    if (!user) {
      return interaction.editReply('🎒 Túi cá của bạn đang trống!');
    }

    const { formatCurrency } = await import('./commands/fish.mjs');
    
    const embed = new EmbedBuilder()
      .setColor('#a29bfe')
      .setTitle('🎒 Túi Cá Của Bạn')
      .setDescription('*Những con cá bạn đã câu được...*')
      .setTimestamp();
        
    let fishList = '';
    let totalValue = 0;
    let totalFish = 0;
    
    // Hiển thị inventory cá
    if (user.inventory && Object.keys(user.inventory).length > 0) {
      for (const [fishType, quantity] of Object.entries(user.inventory)) {
        if (quantity > 0) {
          const fishInfo = getFishInfo(fishType);
          const value = fishInfo.value * quantity;
          totalValue += value;
          totalFish += quantity;
          
          fishList += `${fishInfo.emoji} **${fishInfo.name}** x${quantity}\n`;
          fishList += `   💰 ${formatCurrency(value)}\n\n`;
        }
      }
    }
    
    if (!fishList) {
      fishList = '🌊 Chưa có cá nào...';
    }
    
    embed.setDescription(fishList);
    embed.addFields([
      {
        name: '📊 Tổng Kết',
        value: `🐟 **Tổng số cá:** ${totalFish}\n💎 **Tổng giá trị:** ${formatCurrency(totalValue)}`,
        inline: false
      }
    ]);
    
    return interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Fish inventory error:', error);
    return interaction.editReply('❌ Có lỗi xảy ra khi xem túi cá!');
  }
}

// Handler cho sửa cần câu
async function handleFishRepair(interaction) {
  try {
    await interaction.deferReply();
    
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    let user = await User.findOne({ userId, guildId });
    
    if (!user) {
      return interaction.editReply('❌ Bạn chưa có tài khoản!');
    }

    const { getRodInfo, formatCurrency } = await import('./commands/fish.mjs');
    
    const rodInfo = getRodInfo(user);
    if (!rodInfo.hasRod) {
      return interaction.editReply('❌ Bạn chưa có cần câu!');
    }
    
    if (rodInfo.durability >= rodInfo.maxDurability) {
      return interaction.editReply('✅ Cần câu của bạn vẫn còn tốt, không cần sửa chữa!');
    }
    
    // Tính toán chi phí sửa chữa
    const missingDurability = rodInfo.maxDurability - rodInfo.durability;
    const repairCost = missingDurability * 50; // 50 xu mỗi điểm độ bền
    
    if ((user.coins || 0) < repairCost) {
      return interaction.editReply(`❌ Bạn cần ${formatCurrency(repairCost)} để sửa cần câu!\n(Hiện có: ${formatCurrency(user.coins || 0)})`);
    }
    
    // Thực hiện sửa chữa
    user.coins = (user.coins || 0) - repairCost;
    user.rodDurability = rodInfo.maxDurability;
    await user.save();
    
    const embed = new EmbedBuilder()
      .setColor('#00b894')
      .setTitle('🔧 Sửa Chữa Thành Công!')
      .setDescription(`✨ Cần câu **${rodInfo.name}** đã được sửa chữa hoàn toàn!`)
      .addFields([
        {
          name: '💰 Chi Phí',
          value: formatCurrency(repairCost),
          inline: true
        },
        {
          name: '💎 Số Dư Còn Lại',
          value: formatCurrency(user.coins),
          inline: true
        },
        {
          name: '🔧 Độ Bền Mới',
          value: `${rodInfo.maxDurability}/${rodInfo.maxDurability} (100%)`,
          inline: false
        }
      ])
      .setTimestamp();
        
    return interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Fish repair error:', error);
    return interaction.editReply('❌ Có lỗi xảy ra khi sửa cần câu!');
  }
}

// Helper function để lấy thông tin cá
function getFishInfo(fishType) {
  const fishData = {
    common: { name: 'Cá Chép', emoji: '🐟', value: 100 },
    uncommon: { name: 'Cá Rô', emoji: '🐠', value: 250 },
    rare: { name: 'Cá Hồi', emoji: '🍣', value: 500 },
    epic: { name: 'Cá Vàng', emoji: '🟡', value: 1000 },
    legendary: { name: 'Cá Rồng', emoji: '🐲', value: 2500 },
    mythic: { name: 'Cá Thiêng', emoji: '⭐', value: 5000 }
  };
  
  return fishData[fishType] || { name: 'Cá Lạ', emoji: '🐟', value: 50 };
}
