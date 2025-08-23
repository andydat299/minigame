import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import User from '../models/User.mjs';
import { formatCurrency, errorEmbed } from './util.mjs';

// Game state storage
const gameRooms = new Map();
const playerBets = new Map();

export const data = new SlashCommandBuilder()
    .setName('taixiu')
    .setDescription('Chơi tài xỉu tự động')
    .addSubcommand(subcommand =>
        subcommand
            .setName('play')
            .setDescription('Chơi tài xỉu với giao diện nút bấm'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('bet')
            .setDescription('Đặt cược tài xỉu')
            .addStringOption(option =>
                option.setName('choice')
                    .setDescription('Chọn tài hoặc xỉu')
                    .setRequired(true)
                    .addChoices(
                        { name: '🔴 TÀI (11-18)', value: 'tai' },
                        { name: '⚫ XỈU (3-10)', value: 'xiu' }
                    ))
            .addIntegerOption(option =>
                option.setName('amount')
                    .setDescription('Số tiền cược')
                    .setRequired(true)
                    .setMinValue(100)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('auto')
            .setDescription('Bật/tắt auto bet')
            .addStringOption(option =>
                option.setName('mode')
                    .setDescription('Chế độ auto')
                    .setRequired(true)
                    .addChoices(
                        { name: '🤖 Bật Auto', value: 'on' },
                        { name: '⏹️ Tắt Auto', value: 'off' }
                    ))
            .addStringOption(option =>
                option.setName('strategy')
                    .setDescription('Chiến thuật auto (khi bật)')
                    .setRequired(false)
                    .addChoices(
                        { name: '🎯 Martingale (gấp đôi khi thua)', value: 'martingale' },
                        { name: '📊 Pattern Following (theo pattern)', value: 'pattern' },
                        { name: '🔄 Fixed Amount (số tiền cố định)', value: 'fixed' },
                        { name: '🎲 Random Choice (ngẫu nhiên)', value: 'random' }
                    ))
            .addIntegerOption(option =>
                option.setName('base_amount')
                    .setDescription('Số tiền cược cơ bản')
                    .setRequired(false)
                    .setMinValue(100)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('stats')
            .setDescription('Xem thống kê tài xỉu'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('history')
            .setDescription('Xem lịch sử kết quả'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('room')
            .setDescription('Quản lý phòng game')
            .addStringOption(option =>
                option.setName('action')
                    .setDescription('Hành động')
                    .setRequired(true)
                    .addChoices(
                        { name: '🎮 Bắt đầu tài xỉu', value: 'start' },
                        { name: '⏹️ Dừng tài xỉu', value: 'stop' },
                        { name: '📊 Xem trạng thái', value: 'status' }
                    )))
    .addSubcommand(subcommand =>
        subcommand
            .setName('jackpot')
            .setDescription('Xem thông tin jackpot'));

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
        case 'play':
            await handlePlay(interaction);
            break;
        case 'bet':
            await handleBet(interaction);
            break;
        case 'auto':
            await handleAuto(interaction);
            break;
        case 'stats':
            await handleStats(interaction);
            break;
        case 'history':
            await handleHistory(interaction);
            break;
        case 'room':
            await handleRoom(interaction);
            break;
    }
}

async function handlePlay(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    let profile = await User.findOne({ userId, guildId });
    if (!profile) profile = await User.create({ userId, guildId });
    
    // Get or create game room
    let gameRoom = gameRooms.get(guildId);
    if (!gameRoom) {
        gameRoom = createNewGameRoom(guildId);
        gameRooms.set(guildId, gameRoom);
        // Start the game loop if not running
        setTimeout(() => startGameLoop(guildId, interaction.channel), 1000);
    }
    
    const timeLeft = Math.max(0, Math.ceil((gameRoom.endTime - Date.now()) / 1000));
    const canBet = gameRoom.status === 'betting' && timeLeft > 0;
    
    const embed = new EmbedBuilder()
        .setColor('#feca57')
        .setTitle('🎲 Tài Xỉu - Chọn Cược')
        .setDescription(`**Ván số #${gameRoom.round}**\n${canBet ? `⏰ Còn ${timeLeft}s để đặt cược` : '🔄 Đang xử lý kết quả...'}`)
        .addFields(
            { name: '💰 Số dư của bạn', value: formatCurrency(profile.coins || 0), inline: true },
            { name: '👥 Đã cược', value: `${gameRoom.bets.length} người`, inline: true },
            { name: '🏆 Tổng pool', value: formatCurrency(gameRoom.totalPool), inline: true }
        )
        .setFooter({ text: canBet ? 'Chọn TÀI hoặc XỈU, sau đó chọn số tiền cược!' : 'Vui lòng chờ ván tiếp theo...' })
        .setTimestamp();
    
    if (!canBet) {
        return interaction.reply({ embeds: [embed] });
    }
    
    // Choice buttons (TÀI/XỈU)
    const taiButton = new ButtonBuilder()
        .setCustomId('tx_choice_tai')
        .setLabel('🔴 TÀI (11-18)')
        .setStyle(ButtonStyle.Danger);
    
    const xiuButton = new ButtonBuilder()
        .setCustomId('tx_choice_xiu')
        .setLabel('⚫ XỈU (3-10)')
        .setStyle(ButtonStyle.Secondary);
    
    const choiceRow = new ActionRowBuilder().addComponents(taiButton, xiuButton);
    
    // Amount buttons
    const amount100 = new ButtonBuilder()
        .setCustomId('tx_amount_100')
        .setLabel('💰 100')
        .setStyle(ButtonStyle.Success)
        .setDisabled((profile.coins || 0) < 100);
    
    const amount1k = new ButtonBuilder()
        .setCustomId('tx_amount_1000')
        .setLabel('💰 1K')
        .setStyle(ButtonStyle.Success)
        .setDisabled((profile.coins || 0) < 1000);
    
    const amount10k = new ButtonBuilder()
        .setCustomId('tx_amount_10000')
        .setLabel('💰 10K')
        .setStyle(ButtonStyle.Success)
        .setDisabled((profile.coins || 0) < 10000);
    
    const amount50k = new ButtonBuilder()
        .setCustomId('tx_amount_50000')
        .setLabel('💰 50K')
        .setStyle(ButtonStyle.Success)
        .setDisabled((profile.coins || 0) < 50000);
    
    const amount100k = new ButtonBuilder()
        .setCustomId('tx_amount_100000')
        .setLabel('💰 100K')
        .setStyle(ButtonStyle.Success)
        .setDisabled((profile.coins || 0) < 100000);
    
    const amountRow1 = new ActionRowBuilder().addComponents(amount100, amount1k, amount10k, amount50k, amount100k);
    
    const amount1m = new ButtonBuilder()
        .setCustomId('tx_amount_1000000')
        .setLabel('💎 1M')
        .setStyle(ButtonStyle.Primary)
        .setDisabled((profile.coins || 0) < 1000000);
    
    const allInButton = new ButtonBuilder()
        .setCustomId('tx_amount_allin')
        .setLabel('🔥 ALL IN')
        .setStyle(ButtonStyle.Danger);
    
    const customButton = new ButtonBuilder()
        .setCustomId('tx_amount_custom')
        .setLabel('✏️ Tùy chỉnh')
        .setStyle(ButtonStyle.Secondary);
    
    const amountRow2 = new ActionRowBuilder().addComponents(amount1m, allInButton, customButton);
    
    // Quick bet buttons
    const quickBetRow1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('quickbet_tai_100')
            .setLabel('🔴 TÀI 100')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('quickbet_xiu_100')
            .setLabel('⚫ XỈU 100')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('quickbet_tai_1000')
            .setLabel('🔴 TÀI 1K')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('quickbet_xiu_1000')
            .setLabel('⚫ XỈU 1K')
            .setStyle(ButtonStyle.Secondary)
    );
    
    const quickBetRow2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('quickbet_tai_10000')
            .setLabel('🔴 TÀI 10K')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('quickbet_xiu_10000')
            .setLabel('⚫ XỈU 10K')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('tx_play_custom')
            .setLabel('🎯 Tùy Chỉnh')
            .setStyle(ButtonStyle.Primary)
    );
    
    const quickBetRow3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('taixiu_analysis')
            .setLabel('🔮 Soi Cầu')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('taixiu_custom')
            .setLabel('🎯 Tùy Chỉnh')
            .setStyle(ButtonStyle.Success)
    );
    
    const message = await channel.send({ 
        embeds: [embed], 
        components: [choiceRow, amountRow1, amountRow2, quickBetRow1, quickBetRow2, quickBetRow3] 
    });
    
    // Store message for potential updates
    gameRoom.currentBettingMessage = message;
}

async function handleBet(interaction) {
    const choice = interaction.options.getString('choice');
    const amount = interaction.options.getInteger('amount');
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    let profile = await User.findOne({ userId, guildId });
    if (!profile) profile = await User.create({ userId, guildId });
    
    if ((profile.coins || 0) < amount) {
        return interaction.reply({
            embeds: [errorEmbed(`Bạn không đủ tiền để cược ${formatCurrency(amount)}!`)],
            ephemeral: true
        });
    }
    
    // Get or create game room
    let gameRoom = gameRooms.get(guildId);
    if (!gameRoom) {
        gameRoom = createNewGameRoom(guildId);
        gameRooms.set(guildId, gameRoom);
    }
    
    // Check if game is accepting bets
    if (gameRoom.status !== 'betting') {
        return interaction.reply({
            embeds: [errorEmbed('Hiện tại không thể đặt cược! Vui lòng đợi ván tiếp theo.')],
            ephemeral: true
        });
    }
    
    // Check if user already bet this round
    const betKey = `${guildId}_${userId}_${gameRoom.round}`;
    if (playerBets.has(betKey)) {
        return interaction.reply({
            embeds: [errorEmbed('Bạn đã đặt cược ván này rồi!')],
            ephemeral: true
        });
    }
    
    // Place bet
    const bet = {
        userId,
        username: interaction.user.username,
        choice,
        amount,
        round: gameRoom.round
    };
    
    playerBets.set(betKey, bet);
    gameRoom.bets.push(bet);
    gameRoom.totalPool += amount;
    
    // Add to jackpot (5% of bet)
    const jackpotContribution = Math.floor(amount * gameRoom.settings.jackpotRate);
    gameRoom.jackpot.amount += jackpotContribution;
    gameRoom.jackpot.contributors++;
    gameRoom.jackpot.totalContributed += jackpotContribution;
    
    // Deduct money temporarily
    profile.coins = (profile.coins || 0) - amount;
    await profile.save();
    
    const embed = new EmbedBuilder()
        .setColor(choice === 'tai' ? '#ff6b6b' : '#2f3136')
        .setTitle('🎲 Đặt Cược Thành Công!')
        .addFields(
            { name: '🎯 Lựa chọn', value: choice === 'tai' ? '🔴 TÀI (11-18)' : '⚫ XỈU (3-10)', inline: true },
            { name: '💰 Số tiền cược', value: formatCurrency(amount), inline: true },
            { name: '🏆 Tổng pool', value: formatCurrency(gameRoom.totalPool), inline: true },
            { name: '⏰ Thời gian còn lại', value: `${Math.ceil((gameRoom.endTime - Date.now()) / 1000)}s`, inline: true },
            { name: '👥 Số người cược', value: `${gameRoom.bets.length}`, inline: true },
            { name: '🎮 Ván số', value: `#${gameRoom.round}`, inline: true }
        )
        .setFooter({ text: 'Chúc bạn may mắn!' })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

async function handleAuto(interaction) {
    const mode = interaction.options.getString('mode');
    const strategy = interaction.options.getString('strategy') || 'fixed';
    const baseAmount = interaction.options.getInteger('base_amount') || 1000;
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    let profile = await User.findOne({ userId, guildId });
    if (!profile) profile = await User.create({ userId, guildId });
    
    if (mode === 'on') {
        // Initialize auto settings
        if (!profile.taixiuAuto) profile.taixiuAuto = {};
        
        profile.taixiuAuto.enabled = true;
        profile.taixiuAuto.strategy = strategy;
        profile.taixiuAuto.baseAmount = baseAmount;
        profile.taixiuAuto.currentAmount = baseAmount;
        profile.taixiuAuto.wins = 0;
        profile.taixiuAuto.losses = 0;
        profile.taixiuAuto.totalProfit = 0;
        
        await profile.save();
        
        const strategyDesc = {
            martingale: 'Gấp đôi tiền cược khi thua, reset khi thắng',
            pattern: 'Phân tích pattern 10 ván gần nhất để đưa ra lựa chọn',
            fixed: 'Luôn cược số tiền cố định',
            random: 'Chọn tài/xỉu ngẫu nhiên'
        };
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🤖 Auto Tài Xỉu Đã Bật!')
            .addFields(
                { name: '📊 Chiến thuật', value: strategyDesc[strategy], inline: false },
                { name: '💰 Tiền cược cơ bản', value: formatCurrency(baseAmount), inline: true },
                { name: '⚠️ Lưu ý', value: 'Bot sẽ tự động đặt cược cho bạn. Hãy đảm bảo có đủ tiền!', inline: false }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    } else {
        // Turn off auto
        if (profile.taixiuAuto) {
            profile.taixiuAuto.enabled = false;
        }
        await profile.save();
        
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('⏹️ Auto Tài Xỉu Đã Tắt!')
            .setDescription('Bot sẽ không tự động đặt cược nữa.')
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
}

async function handleStats(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    let profile = await User.findOne({ userId, guildId });
    if (!profile) profile = await User.create({ userId, guildId });
    
    const stats = profile.taixiuStats || {
        totalGames: 0,
        wins: 0,
        losses: 0,
        totalBet: 0,
        totalWin: 0,
        biggestWin: 0,
        biggestLoss: 0,
        winStreak: 0,
        currentStreak: 0
    };
    
    const winRate = stats.totalGames > 0 ? ((stats.wins / stats.totalGames) * 100).toFixed(1) : 0;
    const profit = stats.totalWin - stats.totalBet;
    
    const embed = new EmbedBuilder()
        .setColor('#48dbfb')
        .setTitle('📊 Thống Kê Tài Xỉu')
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
            { name: '🎮 Tổng số ván', value: `${stats.totalGames}`, inline: true },
            { name: '🏆 Thắng', value: `${stats.wins}`, inline: true },
            { name: '💀 Thua', value: `${stats.losses}`, inline: true },
            { name: '📈 Tỷ lệ thắng', value: `${winRate}%`, inline: true },
            { name: '💰 Tổng lãi/lỗ', value: formatCurrency(profit), inline: true },
            { name: '🔥 Chuỗi thắng tốt nhất', value: `${stats.winStreak}`, inline: true },
            { name: '💎 Thắng lớn nhất', value: formatCurrency(stats.biggestWin), inline: true },
            { name: '💸 Thua lớn nhất', value: formatCurrency(stats.biggestLoss), inline: true },
            { name: '📊 Chuỗi hiện tại', value: `${stats.currentStreak >= 0 ? '+' : ''}${stats.currentStreak}`, inline: true }
        );
    
    if (profile.taixiuAuto?.enabled) {
        embed.addFields({
            name: '🤖 Auto Status',
            value: `✅ Đang bật\nChiến thuật: ${profile.taixiuAuto.strategy}\nTiền cược: ${formatCurrency(profile.taixiuAuto.currentAmount)}`,
            inline: false
        });
    }
    
    // Add jackpot info to stats
    const gameRoom = gameRooms.get(guildId);
    if (gameRoom?.jackpot) {
        embed.addFields({
            name: '🎰 Jackpot System',
            value: `💎 Hiện tại: ${formatCurrency(gameRoom.jackpot.amount)}\n🎯 Trúng với: **Triple** (3 số giống nhau)\n📊 Tỷ lệ: ~0.46% (1/216)`,
            inline: false
        });
        
        if (gameRoom.jackpot.lastWinner) {
            embed.addFields({
                name: '🏆 Jackpot gần nhất',
                value: `👤 ${gameRoom.jackpot.lastWinner}\n💰 ${formatCurrency(gameRoom.jackpot.lastWinAmount)}`,
                inline: true
            });
        }
    }
    
    await interaction.reply({ embeds: [embed] });
}

async function handleHistory(interaction) {
    const guildId = interaction.guildId;
    
    let gameRoom = gameRooms.get(guildId);
    if (!gameRoom || gameRoom.history.length === 0) {
        return interaction.reply({
            embeds: [errorEmbed('Chưa có lịch sử game nào!')],
            ephemeral: true
        });
    }
    
    const recent = gameRoom.history.slice(-10).reverse();
    const historyText = recent.map((result, index) => {
        const dice = result.dice.join(' + ');
        const total = result.total;
        const outcome = result.result;
        const emoji = outcome === 'tai' ? '🔴' : '⚫';
        
        return `**Ván ${result.round}:** ${emoji} ${outcome.toUpperCase()} (${dice} = ${total})`;
    }).join('\n');
    
    // Pattern analysis
    const last10 = gameRoom.history.slice(-10);
    const taiCount = last10.filter(r => r.result === 'tai').length;
    const xiuCount = last10.filter(r => r.result === 'xiu').length;
    
    const embed = new EmbedBuilder()
        .setColor('#feca57')
        .setTitle('📜 Lịch Sử Tài Xỉu (10 ván gần nhất)')
        .setDescription(historyText)
        .addFields(
            { name: '📊 Thống kê 10 ván', value: `🔴 Tài: ${taiCount}\n⚫ Xỉu: ${xiuCount}`, inline: true },
            { name: '🎯 Xu hướng', value: taiCount > xiuCount ? '🔴 Nghiêng về TÀI' : xiuCount > taiCount ? '⚫ Nghiêng về XỈU' : '⚖️ Cân bằng', inline: true }
        )
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

async function handleRoom(interaction) {
    const action = interaction.options.getString('action');
    const guildId = interaction.guildId;
    
    try {
        if (!global.taiXiuManager) {
            return interaction.reply({
                embeds: [errorEmbed('Hệ thống tài xỉu chưa sẵn sàng!')],
                ephemeral: true
            });
        }

        if (action === 'start') {
            // Check permissions
            if (!interaction.member.permissions.has('MANAGE_GUILD')) {
                return interaction.reply({
                    embeds: [errorEmbed('Bạn cần quyền "Quản lý server" để bắt đầu tài xỉu!')],
                    ephemeral: true
                });
            }

            const existingGame = await global.taiXiuManager.getGameData(guildId);
            if (existingGame && existingGame.isActive) {
                return interaction.reply({
                    embeds: [errorEmbed('Tài xỉu đã đang chạy trong server này!')],
                    ephemeral: true
                });
            }

            await global.taiXiuManager.startGame(guildId, interaction.channelId);
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🎮 Tài Xỉu Đã Bắt Đầu!')
                .setDescription('Game tài xỉu đã được khởi động và sẽ chạy liên tục 24/7!')
                .addFields([
                    { name: '📍 Kênh', value: `<#${interaction.channelId}>`, inline: true },
                    { name: '🔄 Auto Restart', value: 'Bật', inline: true },
                    { name: '⏰ Thời gian mỗi ván', value: '30 giây', inline: true }
                ])
                .setFooter({ text: 'Game sẽ tự động khôi phục sau khi bot restart!' })
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });

        } else if (action === 'stop') {
            // Check permissions
            if (!interaction.member.permissions.has('MANAGE_GUILD')) {
                return interaction.reply({
                    embeds: [errorEmbed('Bạn cần quyền "Quản lý server" để dừng tài xỉu!')],
                    ephemeral: true
                });
            }

            const gameData = await global.taiXiuManager.getGameData(guildId);
            if (!gameData || !gameData.isActive) {
                return interaction.reply({
                    embeds: [errorEmbed('Không có game tài xỉu nào đang chạy!')],
                    ephemeral: true
                });
            }

            await global.taiXiuManager.stopGame(guildId);
            
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('⏹️ Tài Xỉu Đã Dừng!')
                .setDescription('Game tài xỉu đã được dừng lại.')
                .addFields([
                    { name: '📊 Tổng ván đã chơi', value: `${gameData.round - 1}`, inline: true },
                    { name: '📈 Lịch sử', value: `${gameData.history.length} kết quả`, inline: true }
                ])
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });

        } else if (action === 'status') {
            const gameData = await global.taiXiuManager.getGameData(guildId);
            if (!gameData) {
                return interaction.reply({
                    embeds: [errorEmbed('Chưa có game tài xỉu nào! Dùng `/taixiu room start` để bắt đầu.')],
                    ephemeral: true
                });
            }

            const gameState = global.taiXiuManager.getGameState(guildId);
            const statusText = gameData.isActive ? 
                (gameData.bettingPhase ? '💰 Đang nhận cược' : '🎲 Đang xử lý') : 
                '⏸️ Đã dừng';
            
            const embed = new EmbedBuilder()
                .setColor(gameData.isActive ? '#48dbfb' : '#95a5a6')
                .setTitle('🎮 Trạng Thái Tài Xỉu')
                .addFields([
                    { name: '🎲 Ván hiện tại', value: `#${gameData.round}`, inline: true },
                    { name: '📊 Trạng thái', value: statusText, inline: true },
                    { name: '⏰ Thời gian còn lại', value: gameData.isActive ? `${gameData.timeLeft || 0}s` : 'N/A', inline: true },
                    { name: '� Kênh game', value: gameData.channelId ? `<#${gameData.channelId}>` : 'Chưa đặt', inline: true },
                    { name: '🏆 Tổng ván đã chơi', value: `${gameData.history.length}`, inline: true },
                    { name: '🔄 Auto Restart', value: gameData.autoRestart ? 'Bật' : 'Tắt', inline: true }
                ])
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Room management error:', error);
        await interaction.reply({
            embeds: [errorEmbed('Có lỗi xảy ra khi quản lý phòng game!')],
            ephemeral: true
        });
    }
}

async function handleJackpot(interaction) {
    const guildId = interaction.guildId;
    
    const gameRoom = gameRooms.get(guildId);
    if (!gameRoom) {
        return interaction.reply({
            embeds: [errorEmbed('Chưa có phòng game nào! Dùng `/taixiu room create` để tạo phòng.')],
            ephemeral: true
        });
    }
    
    const jackpot = gameRoom.jackpot;
    
    // Find recent jackpot winners in history
    const recentJackpots = gameRoom.history
        .filter(r => r.isJackpot)
        .slice(-5)
        .reverse();
    
    const embed = new EmbedBuilder()
        .setColor('#ffd700')
        .setTitle('🎰 JACKPOT SYSTEM 🎰')
        .setDescription('**Hệ thống Jackpot tích lũy từ 5% mỗi lần cược!**')
        .addFields(
            { name: '💎 Jackpot Hiện Tại', value: formatCurrency(jackpot.amount), inline: true },
            { name: '👥 Người đóng góp', value: `${jackpot.contributors} lượt`, inline: true },
            { name: '💰 Tổng đã tích lũy', value: formatCurrency(jackpot.totalContributed), inline: true },
            { name: '🎯 Cách trúng Jackpot', value: '🎲 Ra **TRIPLE** (3 số giống nhau)\n⚀⚀⚀ | ⚁⚁⚁ | ⚂⚂⚂ | ⚃⚃⚃ | ⚄⚄⚄ | ⚅⚅⚅', inline: false },
            { name: '📊 Tỷ lệ trúng', value: '🎯 **1/216** (~0.46%)\n💝 5% mỗi cược tích lũy vào Jackpot', inline: true },
            { name: '🏆 Phần thưởng', value: '💰 100% Jackpot cho người thắng\n🌱 20% làm seed cho jackpot mới', inline: true }
        );
    
    if (jackpot.lastWinner) {
        embed.addFields({
            name: '🎉 Người thắng gần nhất',
            value: `👤 **${jackpot.lastWinner}**\n💰 ${formatCurrency(jackpot.lastWinAmount)}`,
            inline: true
        });
    }
    
    if (recentJackpots.length > 0) {
        const jackpotHistory = recentJackpots.map((result, index) => {
            const diceEmojis = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
            const dice = result.dice.map(d => diceEmojis[d]).join('');
            return `**Ván ${result.round}:** ${dice} - ${result.jackpotWinner} (+${formatCurrency(result.jackpotAmount)})`;
        }).join('\n');
        
        embed.addFields({
            name: '📜 Lịch sử Jackpot (5 lần gần nhất)',
            value: jackpotHistory || 'Chưa có ai trúng jackpot!',
            inline: false
        });
    }
    
    embed.setFooter({ text: 'Chúc bạn may mắn trúng Jackpot! 🍀' })
         .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

function createNewGameRoom(guildId, duration = 30) {
    return {
        guildId,
        round: 1,
        status: 'betting', // 'betting' | 'summary' | 'rolling' | 'finished'
        startTime: Date.now(),
        endTime: Date.now() + (duration * 1000),
        duration: duration * 1000,
        bets: [],
        totalPool: 0,
        history: [],
        currentBettingMessage: null,
        // Jackpot system
        jackpot: {
            amount: 0,
            contributors: 0,
            lastWinner: null,
            lastWinAmount: 0,
            totalContributed: 0
        },
        settings: {
            duration,
            autoStart: true,
            jackpotRate: 0.05 // 5% of each bet goes to jackpot
        }
    };
}

async function startGameLoop(guildId, channel) {
    const gameRoom = gameRooms.get(guildId);
    if (!gameRoom) return;
    
    // Send initial betting interface
    await sendBettingInterface(gameRoom, channel);
    
    // Countdown update interval
    const countdownInterval = setInterval(async () => {
        if (gameRoom.status === 'betting') {
            const timeLeft = Math.max(0, Math.ceil((gameRoom.endTime - Date.now()) / 1000));
            
            if (timeLeft > 0 && timeLeft <= 30 && timeLeft % 5 === 0 && gameRoom.currentBettingMessage) {
                // Update countdown every 5 seconds in last 30 seconds
                await updateBettingInterface(gameRoom, timeLeft);
            }
        }
    }, 1000);
    
    // Store countdown interval for cleanup
    gameRoom.countdownInterval = countdownInterval;
    
    // Game loop
    const gameInterval = setInterval(async () => {
        const now = Date.now();
        
        if (gameRoom.status === 'betting' && now >= gameRoom.endTime) {
            // End betting, show summary
            gameRoom.status = 'summary';
            
            // Clear countdown interval
            if (gameRoom.countdownInterval) {
                clearInterval(gameRoom.countdownInterval);
            }
            
            await showBettingSummary(gameRoom, channel);
            
            // Wait 3 seconds then start rolling
            setTimeout(async () => {
                gameRoom.status = 'rolling';
                
                if (gameRoom.bets.length > 0) {
                    await processGameResult(guildId, channel);
                } else {
                    // No bets, just show empty result
                    const noPlayerEmbed = new EmbedBuilder()
                        .setColor('#feca57')
                        .setTitle('🎲 Không Có Người Chơi')
                        .setDescription(`Ván #${gameRoom.round} không có ai đặt cược`)
                        .setTimestamp();
                    
                    await channel.send({ embeds: [noPlayerEmbed] });
                }
                
                // Wait 5 seconds after result, then start new round
                setTimeout(async () => {
                    // Start new round
                    gameRoom.round++;
                    gameRoom.status = 'betting';
                    gameRoom.startTime = Date.now();
                    gameRoom.endTime = Date.now() + gameRoom.duration;
                    gameRoom.bets = [];
                    gameRoom.totalPool = 0;
                    
                    // Clear player bets for this guild and new round
                    const keysToDelete = [];
                    for (const [key, bet] of playerBets.entries()) {
                        if (key.startsWith(`${guildId}_`) && bet.round < gameRoom.round) {
                            keysToDelete.push(key);
                        }
                    }
                    keysToDelete.forEach(key => playerBets.delete(key));
                    
                    // Process auto bets for new round
                    await processAutoBets(guildId);
                    
                    // Send new betting interface for next round
                    await sendBettingInterface(gameRoom, channel);
                }, 5000);
            }, 3000);
        }
    }, 1000);
    
    // Store interval for cleanup
    gameRoom.interval = gameInterval;
}

// Function to send betting interface automatically
async function sendBettingInterface(gameRoom, channel) {
    const timeLeft = Math.max(0, Math.ceil((gameRoom.endTime - Date.now()) / 1000));
    
    if (timeLeft <= 0) return;
    
    const embed = new EmbedBuilder()
        .setColor('#feca57')
        .setTitle('🎲 Tài Xỉu - Ván Mới Bắt Đầu!')
        .setDescription(`**Ván số #${gameRoom.round}**\n⏰ **${timeLeft}s** để đặt cược`)
        .addFields(
            { name: '🎯 Cách chơi', value: '🔴 TÀI (11-18) | ⚫ XỈU (3-10)', inline: true },
            { name: '💰 Tỷ lệ thưởng', value: '1:1 (gấp đôi tiền cược)', inline: true },
            { name: '👥 Đã cược', value: `${gameRoom.bets.length} người`, inline: true },
            { name: '🏆 Tổng pool', value: formatCurrency(gameRoom.totalPool), inline: true },
            { name: '⏱️ Countdown', value: `**${timeLeft}** giây`, inline: true },
            { name: '� JACKPOT', value: `🎰 ${formatCurrency(gameRoom.jackpot.amount)}`, inline: true },
            { name: '�📊 Tiến độ', value: createProgressBar(0, 20) + ' 0%', inline: false },
            { name: '🎊 Jackpot Info', value: `🎯 Cơ hội trúng: **Triple (3 số giống nhau)**\n💝 5% mỗi cược → Jackpot`, inline: false }
        )
        .setFooter({ text: 'Nhấn nút bên dưới để tham gia!' })
        .setTimestamp();
    
    // Quick bet buttons
    const quickBetRow1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('quickbet_tai_100')
            .setLabel('🔴 TÀI 100')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('quickbet_xiu_100')
            .setLabel('⚫ XỈU 100')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('quickbet_tai_1000')
            .setLabel('🔴 TÀI 1K')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('quickbet_xiu_1000')
            .setLabel('⚫ XỈU 1K')
            .setStyle(ButtonStyle.Secondary)
    );
    
    const quickBetRow2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('quickbet_tai_10000')
            .setLabel('🔴 TÀI 10K')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('quickbet_xiu_10000')
            .setLabel('⚫ XỈU 10K')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('tx_play_custom')
            .setLabel('🎯 Tùy Chỉnh')
            .setStyle(ButtonStyle.Primary)
    );
    
    const quickBetRow3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('taixiu_analysis')
            .setLabel('🔮 Soi Cầu')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('taixiu_custom')
            .setLabel('🎯 Tùy Chỉnh')
            .setStyle(ButtonStyle.Success)
    );
    
    const message = await channel.send({ 
        embeds: [embed], 
        components: [quickBetRow1, quickBetRow2, quickBetRow3] 
    });
    
    // Store message for potential updates
    gameRoom.currentBettingMessage = message;
}

// Function to update betting interface with countdown
async function updateBettingInterface(gameRoom, timeLeft) {
    if (!gameRoom.currentBettingMessage) return;
    
    try {
        const urgencyColor = timeLeft <= 10 ? '#ff6b6b' : timeLeft <= 20 ? '#feca57' : '#00ff00';
        const urgencyEmoji = timeLeft <= 10 ? '🚨' : timeLeft <= 20 ? '⚠️' : '✅';
        
        const embed = new EmbedBuilder()
            .setColor(urgencyColor)
            .setTitle(`🎲 Tài Xỉu - Ván Đang Diễn Ra! ${urgencyEmoji}`)
            .setDescription(`**Ván số #${gameRoom.round}**\n⏰ **${timeLeft}s** còn lại để đặt cược!\n${timeLeft <= 10 ? '🔥 **GẤP! GẤP! GẤP!**' : timeLeft <= 20 ? '⚡ **Sắp hết thời gian!**' : '🎯 **Còn nhiều thời gian**'}`)
            .addFields(
                { name: '🎯 Cách chơi', value: '🔴 TÀI (11-18) | ⚫ XỈU (3-10)', inline: true },
                { name: '💰 Tỷ lệ thưởng', value: '1:1 (gấp đôi tiền cược)', inline: true },
                { name: '👥 Đã cược', value: `${gameRoom.bets.length} người`, inline: true },
                { name: '🏆 Tổng pool', value: formatCurrency(gameRoom.totalPool), inline: true },
                { name: '⏱️ Trạng thái', value: `${timeLeft <= 5 ? '🔴 Sắp đóng cửa!' : '🟢 Đang mở'}`, inline: true },
                { name: '🎲 Countdown', value: `**${timeLeft}** giây`, inline: true }
            )
            .setFooter({ 
                text: timeLeft <= 10 ? 'Nhanh tay đặt cược ngay!' : 'Nhấn nút bên dưới để tham gia!' 
            })
            .setTimestamp();
        
        // Add progress bar
        const totalTime = gameRoom.duration / 1000;
        const progress = Math.max(0, (totalTime - timeLeft) / totalTime);
        const progressBar = createProgressBar(progress, 20);
        
        embed.addFields({
            name: '📊 Tiến độ',
            value: `${progressBar} ${Math.round(progress * 100)}%`,
            inline: false
        });
        
        await gameRoom.currentBettingMessage.edit({ embeds: [embed] });
    } catch (error) {
        console.log('Could not update betting interface:', error.message);
    }
}

// Create ASCII progress bar
function createProgressBar(progress, length = 20) {
    const filled = Math.round(progress * length);
    const empty = length - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `[${bar}]`;
}

// Function to show betting summary before dice roll
async function showBettingSummary(gameRoom, channel) {
    // Disable current betting message buttons
    if (gameRoom.currentBettingMessage) {
        try {
            const disabledRow1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('disabled_1')
                    .setLabel('🔴 TÀI 100')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('disabled_2')
                    .setLabel('⚫ XỈU 100')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('disabled_3')
                    .setLabel('🔴 TÀI 1K')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('disabled_4')
                    .setLabel('⚫ XỈU 1K')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
            
            const disabledRow2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('disabled_5')
                    .setLabel('🔴 TÀI 10K')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('disabled_6')
                    .setLabel('⚫ XỈU 10K')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('disabled_7')
                    .setLabel('🔒 Đã Chốt')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true)
            );
            
            const closedEmbed = new EmbedBuilder()
                .setColor('#ff6b35')
                .setTitle('🔒 Hết Thời Gian Đặt Cược')
                .setDescription(`**Ván số #${gameRoom.round}**\n⏰ Thời gian đặt cược đã kết thúc`)
                .addFields(
                    { name: '🎯 Trạng thái', value: '🔒 Đã chốt cược', inline: true },
                    { name: '👥 Đã cược', value: `${gameRoom.bets.length} người`, inline: true },
                    { name: '🏆 Tổng pool', value: formatCurrency(gameRoom.totalPool), inline: true }
                )
                .setFooter({ text: 'Đang chuẩn bị lắc xúc xắc...' })
                .setTimestamp();
            
            await gameRoom.currentBettingMessage.edit({ 
                embeds: [closedEmbed], 
                components: [disabledRow1, disabledRow2] 
            });
        } catch (error) {
            console.log('Could not edit betting message:', error.message);
        }
    }
    
    const taiPlayers = gameRoom.bets.filter(bet => bet.choice === 'tai');
    const xiuPlayers = gameRoom.bets.filter(bet => bet.choice === 'xiu');
    
    const taiTotal = taiPlayers.reduce((sum, bet) => sum + bet.amount, 0);
    const xiuTotal = xiuPlayers.reduce((sum, bet) => sum + bet.amount, 0);
    
    const embed = new EmbedBuilder()
        .setColor('#ff6b35')
        .setTitle('🔒 CHỐT CƯỢC - Ván #' + gameRoom.round)
        .setDescription('**Thời gian đặt cược đã kết thúc!**\n🎲 Chuẩn bị lắc xúc xắc...')
        .addFields(
            { name: '📊 Tổng Kết', value: `👥 **${gameRoom.bets.length}** người tham gia\n💰 **${formatCurrency(gameRoom.totalPool)}** tổng pool`, inline: false },
            { name: '🔴 TÀI (11-18)', value: `👥 ${taiPlayers.length} người\n💰 ${formatCurrency(taiTotal)}`, inline: true },
            { name: '⚫ XỈU (3-10)', value: `👥 ${xiuPlayers.length} người\n💰 ${formatCurrency(xiuTotal)}`, inline: true },
            { name: '⏱️ Trạng thái', value: '🔄 Đang chuẩn bị...', inline: true }
        )
        .setFooter({ text: 'Xúc xắc sẽ được lắc sau 3 giây!' })
        .setTimestamp();
    
    // Show top bettors if any
    if (gameRoom.bets.length > 0) {
        const topBets = gameRoom.bets
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 3)
            .map((bet, index) => {
                const emoji = ['🥇', '🥈', '🥉'][index];
                const choice = bet.choice === 'tai' ? '🔴 TÀI' : '⚫ XỈU';
                return `${emoji} **${bet.username}**: ${choice} - ${formatCurrency(bet.amount)}`;
            })
            .join('\n');
        
        embed.addFields({ 
            name: '🏆 Top Cược Thủ', 
            value: topBets, 
            inline: false 
        });
    }
    
    await channel.send({ embeds: [embed] });
}

async function processGameResult(guildId, channel) {
    const gameRoom = gameRooms.get(guildId);
    if (!gameRoom || gameRoom.bets.length === 0) return;
    
    // Show dice rolling animation with 3D effects
    const rollingEmbed = new EmbedBuilder()
        .setColor('#feca57')
        .setTitle('🎲 Đang Lắc Xúc Xắc 3D...')
        .setDescription('🎯 Xúc xắc đang bay trong không gian 3D!')
        .addFields(
            { name: '🎲 Xúc xắc 3D', value: '🎲 🎲 🎲', inline: true },
            { name: '👥 Người chơi', value: `${gameRoom.bets.length}`, inline: true },
            { name: '💰 Tổng pool', value: formatCurrency(gameRoom.totalPool), inline: true }
        )
        .setTimestamp();
    
    const rollingMessage = await channel.send({ embeds: [rollingEmbed] });
    
    // 3D Animation sequence - realistic physics simulation
    const dice3DFrames = [
        { dice: ['🎲', '🎲', '🎲'], desc: '🚀 Ném xúc xắc lên cao...', color: '#ff6b6b' },
        { dice: ['⬆️', '⬆️', '⬆️'], desc: '⬆️ Bay lên trong không gian...', color: '#ff6b6b' },
        { dice: ['🌪️', '🌪️', '🌪️'], desc: '🌪️ Xoay vòng trong không khí...', color: '#feca57' },
        { dice: ['🔄', '🔄', '🔄'], desc: '🔄 Quay nhanh như lốc xoáy...', color: '#feca57' },
        { dice: ['💫', '⭐', '✨'], desc: '✨ Lấp lánh trong ánh sáng...', color: '#ff9ff3' },
        { dice: ['🌟', '💫', '⭐'], desc: '🌟 Phản chiếu ánh đèn casino...', color: '#ff9ff3' },
        { dice: ['🔴', '🟡', '🔵'], desc: '🎨 Các mặt xúc xắc lóe sáng...', color: '#48dbfb' },
        { dice: ['🟢', '🟣', '🟠'], desc: '🌈 Màu sắc thay đổi liên tục...', color: '#48dbfb' },
        { dice: ['🟡', '🔵', '🔴'], desc: '⚡ Tốc độ quay cực nhanh...', color: '#48dbfb' },
        { dice: ['⬇️', '⬇️', '⬇️'], desc: '⬇️ Bắt đầu rơi xuống...', color: '#00ff00' },
        { dice: ['🎯', '🎯', '🎯'], desc: '🎯 Chuẩn bị chạm bàn...', color: '#00ff00' },
        { dice: ['💥', '💥', '💥'], desc: '💥 Chạm bàn với tiếng ầm...', color: '#00ff00' },
        { dice: ['⚡', '⚡', '⚡'], desc: '⚡ Nảy lên lần cuối...', color: '#00ff00' },
        { dice: ['💎', '💎', '💎'], desc: '💎 Sắp dừng hẳn...', color: '#00ff00' },
        { dice: ['✨', '✨', '✨'], desc: '✨ Hoàn thành cuộc lắc!', color: '#00ff00' }
    ];
    
    // Play 3D animation with dynamic timing
    for (let i = 0; i < dice3DFrames.length; i++) {
        const frame = dice3DFrames[i];
        const progress = Math.round((i / (dice3DFrames.length - 1)) * 100);
        
        const animEmbed = new EmbedBuilder()
            .setColor(frame.color)
            .setTitle(`🎲 Lắc Xúc Xắc 3D - ${progress}%`)
            .setDescription(frame.desc)
            .addFields(
                { name: '🎲 Xúc xắc 3D', value: `${frame.dice[0]} ${frame.dice[1]} ${frame.dice[2]}`, inline: true },
                { name: '👥 Người chơi', value: `${gameRoom.bets.length}`, inline: true },
                { name: '💰 Tổng pool', value: formatCurrency(gameRoom.totalPool), inline: true },
                { name: '📊 Tiến độ 3D', value: createProgressBar(progress / 100, 15) + ` ${progress}%`, inline: false }
            )
            .setFooter({ text: i < 8 ? '🎪 Xúc xắc đang bay trong không gian!' : i < 12 ? '⏰ Sắp có kết quả!' : '🎉 Hoàn thành động tác 3D!' })
            .setTimestamp();
        
        await rollingMessage.edit({ embeds: [animEmbed] });
        
        // Dynamic timing for realistic physics
        const delay = i < 5 ? 350 : i < 10 ? 450 : i < 12 ? 650 : 900;
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Animation sequence with more frames
    const diceFrames = [
        // Initial shake
        ['🎲', '🎲', '🎲'],
        ['🎯', '🎯', '🎯'],
        ['💫', '💫', '💫'],
        // Color spinning
        ['🔴', '🟡', '🔵'],
        ['🟡', '🔵', '🔴'],
        ['🔵', '🔴', '🟡'],
        ['🟢', '🟣', '🟠'],
        ['🟣', '🟠', '🟢'],
        ['🟠', '🟢', '🟣'],
        // Dice symbols
        ['⚪', '⚫', '⚪'],
        ['⚫', '⚪', '⚫'],
        ['�', '�', '�'],
        // Final shake
        ['�', '�', '�'],
        ['✨', '✨', '✨'],
        ['🎲', '🎲', '🎲']
    ];
    
    // Animate for 5 seconds with faster transitions
    for (let i = 0; i < 15; i++) {
        const frame = diceFrames[i % diceFrames.length];
        const animEmbed = new EmbedBuilder()
            .setColor('#feca57')
            .setTitle(`🎲 Đang Lắc Xúc Xắc... ${i < 10 ? '🔥' : i < 12 ? '⚡' : '💫'}`)
            .setDescription(`🎯 ${i < 5 ? 'Bắt đầu lắc...' : i < 10 ? 'Đang quay mạnh...' : i < 13 ? 'Sắp ra kết quả...' : 'Hoàn thành!'}`)
            .addFields(
                { name: '🎲 Xúc xắc', value: `${frame[0]} ${frame[1]} ${frame[2]}`, inline: true },
                { name: '👥 Người chơi', value: `${gameRoom.bets.length}`, inline: true },
                { name: '💰 Tổng pool', value: formatCurrency(gameRoom.totalPool), inline: true }
            )
            .setTimestamp();
        
        await rollingMessage.edit({ embeds: [animEmbed] });
        // Faster animation toward the end
        const delay = i < 10 ? 400 : i < 13 ? 300 : 200;
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Roll dice
    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const dice3 = Math.floor(Math.random() * 6) + 1;
    const total = dice1 + dice2 + dice3;
    const result = total >= 11 ? 'tai' : 'xiu';
    
    // Convert numbers to dice emojis
    const diceEmojis = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    const dice1Emoji = diceEmojis[dice1];
    const dice2Emoji = diceEmojis[dice2];
    const dice3Emoji = diceEmojis[dice3];
    
    // Check for JACKPOT (triple)
    const isJackpot = (dice1 === dice2 && dice2 === dice3);
    let jackpotWinner = null;
    
    if (isJackpot && gameRoom.bets.length > 0) {
        // Random jackpot winner from all players
        const randomIndex = Math.floor(Math.random() * gameRoom.bets.length);
        jackpotWinner = gameRoom.bets[randomIndex];
        
        // Award jackpot
        const jackpotAmount = gameRoom.jackpot.amount;
        const winner = await User.findOne({ userId: jackpotWinner.userId, guildId });
        if (winner) {
            winner.coins = (winner.coins || 0) + jackpotAmount;
            await winner.save();
        }
        
        // Update jackpot records
        gameRoom.jackpot.lastWinner = jackpotWinner.username;
        gameRoom.jackpot.lastWinAmount = jackpotAmount;
        
        // Reset jackpot but keep 20% as seed
        const seedAmount = Math.floor(jackpotAmount * 0.2);
        gameRoom.jackpot.amount = seedAmount;
        gameRoom.jackpot.contributors = 0;
    }
    
    // Store result
    const gameResult = {
        round: gameRoom.round,
        dice: [dice1, dice2, dice3],
        total,
        result,
        isJackpot,
        jackpotWinner: jackpotWinner?.username || null,
        jackpotAmount: isJackpot ? gameRoom.jackpot.lastWinAmount : 0,
        timestamp: Date.now()
    };
    
    gameRoom.history.push(gameResult);
    
    // Process winnings
    let winners = [];
    let losers = [];
    
    for (const bet of gameRoom.bets) {
        const user = await User.findOne({ userId: bet.userId, guildId });
        if (!user) continue;
        
        // Initialize stats if not exists
        if (!user.taixiuStats) {
            user.taixiuStats = {
                totalGames: 0,
                wins: 0,
                losses: 0,
                totalBet: 0,
                totalWin: 0,
                biggestWin: 0,
                biggestLoss: 0,
                winStreak: 0,
                currentStreak: 0
            };
        }
        
        user.taixiuStats.totalGames++;
        user.taixiuStats.totalBet += bet.amount;
        
        if (bet.choice === result) {
            // Winner
            const winAmount = bet.amount * 2; // 1:1 payout + original bet
            user.coins = (user.coins || 0) + winAmount;
            user.taixiuStats.wins++;
            user.taixiuStats.totalWin += winAmount;
            user.taixiuStats.currentStreak = Math.max(0, user.taixiuStats.currentStreak) + 1;
            user.taixiuStats.winStreak = Math.max(user.taixiuStats.winStreak, user.taixiuStats.currentStreak);
            
            if (winAmount > user.taixiuStats.biggestWin) {
                user.taixiuStats.biggestWin = winAmount;
            }
            
            // Update auto settings
            if (user.taixiuAuto?.enabled && user.taixiuAuto.strategy === 'martingale') {
                user.taixiuAuto.currentAmount = user.taixiuAuto.baseAmount; // Reset to base
            }
            
            winners.push({ ...bet, winAmount });
        } else {
            // Loser
            user.taixiuStats.losses++;
            user.taixiuStats.currentStreak = Math.min(0, user.taixiuStats.currentStreak) - 1;
            
            if (bet.amount > user.taixiuStats.biggestLoss) {
                user.taixiuStats.biggestLoss = bet.amount;
            }
            
            // Update auto settings
            if (user.taixiuAuto?.enabled && user.taixiuAuto.strategy === 'martingale') {
                user.taixiuAuto.currentAmount = Math.min(user.taixiuAuto.currentAmount * 2, 50000); // Double, max 50k
            }
            
            losers.push(bet);
        }
        
        await user.save();
    }
    
    // Send result message
    const resultEmbed = new EmbedBuilder()
        .setColor(isJackpot ? '#ffd700' : result === 'tai' ? '#ff6b6b' : '#2f3136')
        .setTitle(isJackpot ? '🎰 JACKPOT! TRIPLE! 🎰' : '🎲 Kết Quả Tài Xỉu')
        .setDescription(isJackpot ? `**🎉 JACKPOT TRIPLE ${dice1}${dice1}${dice1}! 🎉**\n${dice1Emoji} ${dice2Emoji} ${dice3Emoji}` : `**${dice1Emoji} ${dice2Emoji} ${dice3Emoji}**`)
        .addFields(
            { name: '🎯 Kết quả', value: `${result === 'tai' ? '🔴 TÀI' : '⚫ XỈU'} (${total} điểm)`, inline: true },
            { name: '🎲 Xúc xắc', value: `${dice1} + ${dice2} + ${dice3} = ${total}`, inline: true },
            { name: '🎮 Ván số', value: `#${gameRoom.round}`, inline: true },
            { name: '🏆 Người thắng', value: winners.length > 0 ? `${winners.length} người` : 'Không có', inline: true },
            { name: '💸 Người thua', value: losers.length > 0 ? `${losers.length} người` : 'Không có', inline: true },
            { name: '💰 Tổng thưởng', value: formatCurrency(winners.reduce((sum, w) => sum + w.winAmount, 0)), inline: true }
        )
        .setTimestamp();
    
    // Add jackpot info if triggered
    if (isJackpot && jackpotWinner) {
        resultEmbed.addFields({
            name: '🎰 JACKPOT WINNER! 🎰',
            value: `🎉 **${jackpotWinner.username}** đã trúng **${formatCurrency(gameResult.jackpotAmount)}**!\n✨ Chúc mừng người chơi may mắn nhất!`,
            inline: false
        });
        resultEmbed.setFooter({ text: '🎊 Jackpot đã được reset! Hãy tiếp tục chơi để tích lũy jackpot mới!' });
    } else {
        resultEmbed.addFields({
            name: '💎 Jackpot Hiện Tại',
            value: `🎰 ${formatCurrency(gameRoom.jackpot.amount)}\n🎯 Trúng khi ra **Triple** (3 số giống nhau)`,
            inline: false
        });
    }
    
    if (winners.length > 0) {
        const winnerList = winners.slice(0, 5).map(w => 
            `${w.username}: +${formatCurrency(w.winAmount)}`
        ).join('\n');
        resultEmbed.addFields({ 
            name: '🎉 Người thắng', 
            value: winnerList + (winners.length > 5 ? `\n... và ${winners.length - 5} người khác` : ''), 
            inline: false 
        });
    }
    
    // Edit the rolling message with final result
    await rollingMessage.edit({ embeds: [resultEmbed] });
}

async function processAutoBets(guildId) {
    const gameRoom = gameRooms.get(guildId);
    if (!gameRoom) return;
    
    // Find users with auto enabled
    const autoUsers = await User.find({ 
        guildId, 
        'taixiuAuto.enabled': true 
    });
    
    for (const user of autoUsers) {
        const auto = user.taixiuAuto;
        if (!auto.enabled || (user.coins || 0) < auto.currentAmount) continue;
        
        // Determine choice based on strategy
        let choice = 'tai'; // default
        
        switch (auto.strategy) {
            case 'random':
                choice = Math.random() > 0.5 ? 'tai' : 'xiu';
                break;
                
            case 'pattern':
                // Analyze last 5 results
                const recent = gameRoom.history.slice(-5);
                const taiCount = recent.filter(r => r.result === 'tai').length;
                choice = taiCount <= 2 ? 'tai' : 'xiu'; // Bet against streak
                break;
                
            case 'martingale':
            case 'fixed':
            default:
                // Use last choice or default to tai
                choice = auto.lastChoice || 'tai';
                break;
        }
        
        // Place auto bet
        const betKey = `${guildId}_${user.userId}_${gameRoom.round}`;
        if (!playerBets.has(betKey)) {
            const bet = {
                userId: user.userId,
                username: user.userId, // Will be replaced with actual username
                choice,
                amount: auto.currentAmount,
                round: gameRoom.round,
                isAuto: true
            };
            
            playerBets.set(betKey, bet);
            gameRoom.bets.push(bet);
            gameRoom.totalPool += auto.currentAmount;
            
            // Deduct money
            user.coins = (user.coins || 0) - auto.currentAmount;
            auto.lastChoice = choice;
            await user.save();
        }
    }
}

// Export for external use
export { gameRooms, playerBets, processGameResult };