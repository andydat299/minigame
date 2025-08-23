import TaiXiuGame from '../models/TaiXiuGame.mjs';
import TaiXiuBet from '../models/TaiXiuBet.mjs';
import User from '../models/User.mjs';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { formatCurrency } from '../commands/util.mjs';

class TaiXiuGameManager {
  constructor(client) {
    this.client = client;
    this.gameTimers = new Map(); // Store timeout IDs
    this.activeGames = new Map(); // Cache active games
  }

  // Initialize on bot startup - restore all active games
  async initializeAllGames() {
    try {
      const activeGames = await TaiXiuGame.find({ 
        isActive: true,
        autoRestart: true 
      });

      console.log(`🎲 Khôi phục ${activeGames.length} game tài xỉu đang hoạt động...`);

      for (const gameData of activeGames) {
        await this.restoreGame(gameData);
      }
    } catch (error) {
      console.error('Error initializing TaiXiu games:', error);
    }
  }

  // Restore a single game from database
  async restoreGame(gameData) {
    try {
      const guild = this.client.guilds.cache.get(gameData.guildId);
      if (!guild) {
        console.log(`Guild ${gameData.guildId} not found, pausing game...`);
        await TaiXiuGame.findByIdAndUpdate(gameData._id, { 
          isActive: false,
          pausedAt: new Date()
        });
        return;
      }

      const channel = guild.channels.cache.get(gameData.channelId);
      if (!channel) {
        console.log(`Channel ${gameData.channelId} not found for guild ${gameData.guildId}`);
        return;
      }

      // Cache the game state
      this.activeGames.set(gameData.guildId, {
        ...gameData.toObject(),
        channel: channel
      });

      // Resume the game cycle
      await this.resumeGameCycle(gameData.guildId);

      console.log(`✅ Khôi phục game tài xỉu cho guild ${guild.name} (${gameData.guildId})`);
    } catch (error) {
      console.error(`Error restoring game for guild ${gameData.guildId}:`, error);
    }
  }

  // Start a new game in a guild
  async startGame(guildId, channelId) {
    try {
      // Check if game already exists
      let gameData = await TaiXiuGame.findOne({ guildId });
      
      if (!gameData) {
        gameData = new TaiXiuGame({
          guildId,
          channelId,
          isActive: true,
          round: 1
        });
        await gameData.save();
      } else {
        // Update existing game
        gameData.channelId = channelId;
        gameData.isActive = true;
        gameData.resumedAt = new Date();
        await gameData.save();
      }

      const guild = this.client.guilds.cache.get(guildId);
      const channel = guild?.channels.cache.get(channelId);

      if (!channel) {
        throw new Error('Channel not found');
      }

      // Cache the game
      this.activeGames.set(guildId, {
        ...gameData.toObject(),
        channel: channel
      });

      // Start the game cycle
      await this.startGameCycle(guildId);

      return gameData;
    } catch (error) {
      console.error('Error starting TaiXiu game:', error);
      throw error;
    }
  }

  // Stop game in a guild
  async stopGame(guildId) {
    try {
      // Clear timer
      if (this.gameTimers.has(guildId)) {
        clearTimeout(this.gameTimers.get(guildId));
        this.gameTimers.delete(guildId);
      }

      // Update database
      await TaiXiuGame.findOneAndUpdate(
        { guildId },
        { 
          isActive: false,
          pausedAt: new Date()
        }
      );

      // Remove from cache
      this.activeGames.delete(guildId);

      console.log(`🛑 Dừng game tài xỉu cho guild ${guildId}`);
    } catch (error) {
      console.error('Error stopping TaiXiu game:', error);
    }
  }

  // Resume game cycle after bot restart
  async resumeGameCycle(guildId) {
    const gameState = this.activeGames.get(guildId);
    if (!gameState) return;

    // Calculate how much time has passed since last update
    const now = Date.now();
    const lastUpdate = gameState.updatedAt ? new Date(gameState.updatedAt).getTime() : now;
    const timePassed = Math.floor((now - lastUpdate) / 1000);

    if (gameState.bettingPhase) {
      const remainingTime = Math.max(0, gameState.timeLeft - timePassed);
      if (remainingTime > 0) {
        // Continue betting phase
        await this.updateGameMessage(guildId, remainingTime, true);
        this.scheduleNextUpdate(guildId, remainingTime);
      } else {
        // Skip to result phase
        await this.endBettingPhase(guildId);
      }
    } else {
      // Was in result phase, start new round
      await this.startNewRound(guildId);
    }
  }

  // Start game cycle for new game
  async startGameCycle(guildId) {
    await this.startNewRound(guildId);
  }

  // Start a new betting round
  async startNewRound(guildId) {
    try {
      const gameState = this.activeGames.get(guildId);
      if (!gameState) return;

      // Update game state
      gameState.bettingPhase = true;
      gameState.timeLeft = gameState.bettingTime;
      gameState.messageId = null; // Reset message ID to send new message
      
      // Clear previous round bets - set all active bets to inactive
      await TaiXiuBet.updateMany(
        { guildId, isActive: true },
        { isActive: false }
      );

      // Reset betting totals for new round
      gameState.totalBets = { tai: 0, xiu: 0 };
      gameState.playerCount = { tai: 0, xiu: 0 };

      // Update database
      await TaiXiuGame.findOneAndUpdate(
        { guildId },
        {
          round: gameState.round,
          bettingPhase: true,
          timeLeft: gameState.bettingTime,
          'totalBets.tai': 0,
          'totalBets.xiu': 0,
          'playerCount.tai': 0,
          'playerCount.xiu': 0,
          messageId: null
        }
      );

      console.log(`🎲 Starting new round ${gameState.round} for guild ${guildId}`);

      // Send new game message immediately
      await this.updateGameMessage(guildId, gameState.bettingTime, true);
      
      // Schedule countdown
      this.scheduleNextUpdate(guildId, gameState.bettingTime);

    } catch (error) {
      console.error('Error starting new round:', error);
    }
  }

  // Schedule the next update
  scheduleNextUpdate(guildId, seconds) {
    if (this.gameTimers.has(guildId)) {
      clearTimeout(this.gameTimers.get(guildId));
    }

    const timer = setTimeout(async () => {
      const gameState = this.activeGames.get(guildId);
      if (!gameState || !gameState.isActive) return;

      if (gameState.bettingPhase) {
        if (seconds > 1) {
          // Continue countdown
          const newTime = seconds - 1;
          gameState.timeLeft = newTime;
          
          // Update message every 5 seconds or last 10 seconds
          if (newTime % 5 === 0 || newTime <= 10) {
            await this.updateGameMessage(guildId, newTime, true);
          }
          
          this.scheduleNextUpdate(guildId, newTime);
        } else {
          // End betting phase
          await this.endBettingPhase(guildId);
        }
      }
    }, 1000);

    this.gameTimers.set(guildId, timer);
  }

  // End betting phase and show results
  async endBettingPhase(guildId) {
    try {
      const gameState = this.activeGames.get(guildId);
      if (!gameState) return;

      gameState.bettingPhase = false;

      // Disable buttons on current message
      await this.disableGameButtons(guildId);

      // Generate result
      const dice = [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1
      ];
      const total = dice.reduce((a, b) => a + b, 0);
      const result = total >= 11 ? 'tai' : 'xiu';

      const resultData = { dice, total, result };
      gameState.lastResult = resultData;

      // Add to history
      const historyEntry = {
        round: gameState.round,
        ...resultData,
        timestamp: new Date()
      };

      // Update database
      await TaiXiuGame.findOneAndUpdate(
        { guildId },
        {
          bettingPhase: false,
          lastResult: resultData,
          $push: { 
            history: {
              $each: [historyEntry],
              $slice: -50 // Keep only last 50 results
            }
          }
        }
      );

      // Process bets and payouts
      await this.processBets(guildId, result, gameState.round);

      // Show result message
      await this.showResultMessage(guildId, resultData);

      // Wait a bit then start next round immediately
      setTimeout(async () => {
        gameState.round++;
        gameState.bettingPhase = true;
        gameState.timeLeft = gameState.bettingTime;
        
        // Reset betting totals for new round
        gameState.totalBets = { tai: 0, xiu: 0 };
        gameState.playerCount = { tai: 0, xiu: 0 };
        
        await this.startNewRound(guildId);
      }, 3000); // Chỉ chờ 3 giây thay vì resultTime

    } catch (error) {
      console.error('Error ending betting phase:', error);
    }
  }

  // Process all bets for the round
  async processBets(guildId, winningResult, round) {
    try {
      const activeBets = await TaiXiuBet.find({
        guildId,
        round: round,
        isActive: true
      });

      for (const bet of activeBets) {
        const isWon = bet.choice === winningResult;
        const payout = isWon ? bet.amount * 2 : 0;

        // Update bet
        bet.isWon = isWon;
        bet.payout = payout;
        bet.isActive = false;
        await bet.save();

        // Update user coins if won
        if (isWon) {
          await User.findOneAndUpdate(
            { userId: bet.userId, guildId },
            { $inc: { coins: payout } }
          );
        }
      }
    } catch (error) {
      console.error('Error processing bets:', error);
    }
  }

  // Update the game message
  async updateGameMessage(guildId, timeLeft, isBetting) {
    try {
      const gameState = this.activeGames.get(guildId);
      if (!gameState) return;

      const embed = await this.createGameEmbed(guildId, timeLeft, isBetting);
      const components = isBetting ? this.createGameButtons() : [];

      let message;
      if (gameState.messageId) {
        try {
          message = await gameState.channel.messages.fetch(gameState.messageId);
          await message.edit({ embeds: [embed], components });
        } catch (error) {
          // Message not found, send new one
          console.log(`🔄 Previous message not found, sending new one for guild ${guildId}`);
          message = await gameState.channel.send({ embeds: [embed], components });
          gameState.messageId = message.id;
        }
      } else {
        // Always send new message when messageId is null
        console.log(`📨 Sending new game message for round ${gameState.round} in guild ${guildId}`);
        message = await gameState.channel.send({ embeds: [embed], components });
        gameState.messageId = message.id;
        
        // Update database with message ID
        await TaiXiuGame.findOneAndUpdate(
          { guildId },
          { messageId: message.id }
        );
      }
    } catch (error) {
      console.error('Error updating game message:', error);
    }
  }

  // Show result with dice animation
  async showResultMessage(guildId, resultData) {
    try {
      const gameState = this.activeGames.get(guildId);
      if (!gameState) return;

      // Step 1: Show dice rolling animation
      const rollingEmbed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('🎲 ĐANG LẮC XÚC XẮC...')
        .setDescription('<a:xucxac:1408720448950243408> <a:xucxac:1408720448950243408> <a:xucxac:1408720448950243408>')
        .setTimestamp();

      const rollingMessage = await gameState.channel.send({ embeds: [rollingEmbed] });

      // Animate dice rolling for 2 seconds với Discord emoji
      const animations = [
        '<a:xucxac:1408720448950243408> <a:xucxac:1408720448950243408> <a:xucxac:1408720448950243408>',
        '<a:xucxac:1408720448950243408><a:xucxac:1408720448950243408><a:xucxac:1408720448950243408>',
        '<a:xucxac:1408720448950243408>   <a:xucxac:1408720448950243408>   <a:xucxac:1408720448950243408>',
        '🌀 <a:xucxac:1408720448950243408> 🌀 <a:xucxac:1408720448950243408> 🌀 <a:xucxac:1408720448950243408> 🌀',
        '⚡ <a:xucxac:1408720448950243408> ⚡ <a:xucxac:1408720448950243408> ⚡ <a:xucxac:1408720448950243408> ⚡',
        '💫 <a:xucxac:1408720448950243408> 💫 <a:xucxac:1408720448950243408> 💫 <a:xucxac:1408720448950243408> 💫',
        '� <a:xucxac:1408720448950243408> � <a:xucxac:1408720448950243408> � <a:xucxac:1408720448950243408> �',
        '✨ <a:xucxac:1408720448950243408> ✨ <a:xucxac:1408720448950243408> ✨ <a:xucxac:1408720448950243408> ✨'
      ];
      // Chỉ hiện emoji xúc xắc tĩnh trong 2.5 giây
      setTimeout(async () => {
        
        // Step 2: Show actual dice faces
        const { dice, total, result } = resultData;
        // Sử dụng emoji Discord đẹp hơn
        const diceEmojis = ['', '<:1a:1408716362779725934>', '<:2a:1408716833665712190>', '<:3a:1408716867631185950>', '<:4a:1408716899692576879>', '<:5a:1408716929056641076>', '<:6a:1408716970118873129>'];
        // Fallback nếu không có custom emoji
        const fallbackDiceEmojis = ['', '🎲①', '🎲②', '🎲③', '🎲④', '🎲⑤', '🎲⑥'];
        
        // Thử sử dụng custom emoji trước, nếu không có thì dùng fallback
        let diceDisplay;
        try {
          diceDisplay = dice.map(d => diceEmojis[d] || fallbackDiceEmojis[d]).join(' ');
        } catch (error) {
          // Nếu custom emoji không hoạt động, dùng emoji mặc định
          const defaultDiceEmojis = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
          diceDisplay = dice.map(d => defaultDiceEmojis[d]).join(' ');
        }
        
        const resultEmbed = new EmbedBuilder()
          .setColor(result === 'tai' ? '#e74c3c' : '#2c3e50')
          .setTitle('🎲 KẾT QUẢ VÁN ' + gameState.round)
          .setDescription(`**${diceDisplay}**\n\n**Tổng: ${total}** ${result === 'tai' ? '🔴' : '⚫'} **${result.toUpperCase()}**`)
          .setTimestamp();

        // Get bet statistics
        const bets = await TaiXiuBet.find({ 
          guildId, 
          round: gameState.round, 
          isActive: true 
        });

        if (bets.length > 0) {
          const winners = bets.filter(bet => bet.choice === result);
          const winnerCount = winners.length;
          const totalWinnings = winners.reduce((sum, bet) => sum + bet.winAmount, 0);
          
          resultEmbed.addFields(
            { 
              name: '🎉 Kết quả', 
              value: `**${winnerCount}** người thắng\nTổng thưởng: **${this.formatCurrency(totalWinnings)}**`, 
              inline: false 
            }
          );
        }

        try {
          await rollingMessage.edit({ embeds: [resultEmbed] });
        } catch (error) {
          // If can't edit, send new message
          await gameState.channel.send({ embeds: [resultEmbed] });
        }
      }, 2500); // Tăng lên 2.5 giây để animation đầy đủ hơn

    } catch (error) {
      console.error('Error showing result message:', error);
    }
  }

  // Create game embed
  async createGameEmbed(guildId, timeLeft, isBetting) {
    const gameData = await TaiXiuGame.findOne({ guildId });
    if (!gameData) return new EmbedBuilder().setDescription('Game not found');

    const embed = new EmbedBuilder()
      .setColor(isBetting ? '#e74c3c' : '#95a5a6')
      .setTitle(`🎲 TÀI XỈU - VÁN ${gameData.round}`)
      .setTimestamp();

    if (isBetting) {
      embed.setDescription(`⏰ **Thời gian còn lại: ${timeLeft}s**\n\n🔴 **TÀI:** Tổng 3 xúc xắc từ **11-18**\n⚫ **XỈU:** Tổng 3 xúc xắc từ **3-10**`);
      
      // Add betting stats
      embed.addFields([
        {
          name: '💰 Tổng Cược',
          value: `🔴 TÀI: ${formatCurrency(gameData.totalBets.tai)} (${gameData.playerCount.tai} người)\n⚫ XỈU: ${formatCurrency(gameData.totalBets.xiu)} (${gameData.playerCount.xiu} người)`,
          inline: false
        }
      ]);
    } else {
      embed.setDescription('⏸️ **Đang xử lý kết quả...**');
    }

    // Add recent history if available
    if (gameData.history && gameData.history.length > 0) {
      const recentHistory = gameData.history.slice(-5).reverse();
      const historyText = recentHistory.map(h => {
        // Sử dụng emoji đẹp hơn cho lịch sử
        const diceEmojis = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        const dice = h.dice.map(d => diceEmojis[d]).join('');
        const resultIcon = h.result === 'tai' ? '🔴' : '⚫';
        return `**${h.round}:** ${dice} = ${h.total} ${resultIcon}`;
      }).join('\n');

      embed.addFields([
        {
          name: '📊 Lịch Sử Gần Đây',
          value: historyText,
          inline: false
        }
      ]);
    }

    return embed;
  }

  // Create result embed
  async createResultEmbed(guildId, resultData) {
    const gameData = await TaiXiuGame.findOne({ guildId });
    const { dice, total, result } = resultData;
    
    const diceEmojis = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    const diceDisplay = dice.map(d => diceEmojis[d]).join(' ');
    const resultIcon = result === 'tai' ? '🔴' : '⚫';
    const resultText = result === 'tai' ? 'TÀI' : 'XỈU';

    const embed = new EmbedBuilder()
      .setColor(result === 'tai' ? '#e74c3c' : '#2c3e50')
      .setTitle(`🎯 KẾT QUẢ VÁN ${gameData.round}`)
      .setDescription(`${diceDisplay}\n\n**Tổng: ${total}** ${resultIcon} **${resultText}**`)
      .setTimestamp();

    // Get winner count and total winnings
    const winnerBets = await TaiXiuBet.find({
      guildId,
      round: gameData.round,
      isWon: true
    });

    const totalWinnings = winnerBets.reduce((sum, bet) => sum + bet.payout, 0);

    embed.addFields([
      {
        name: '🏆 Thống Kê',
        value: `**Người thắng:** ${winnerBets.length}\n**Tổng thưởng:** ${formatCurrency(totalWinnings)}`,
        inline: false
      }
    ]);

    return embed;
  }

  // Disable buttons on current game message
  async disableGameButtons(guildId) {
    try {
      const gameState = this.activeGames.get(guildId);
      if (!gameState || !gameState.messageId) return;

      const embed = await this.createGameEmbed(guildId, 0, false);
      embed.setDescription('⏸️ **Ván đã kết thúc - Đang xử lý kết quả...**');
      embed.setColor('#95a5a6');

      // Create disabled buttons
      const disabledButtons = this.createDisabledButtons();

      try {
        const message = await gameState.channel.messages.fetch(gameState.messageId);
        await message.edit({ embeds: [embed], components: disabledButtons });
        console.log(`🔒 Disabled buttons for round ${gameState.round} in guild ${guildId}`);
      } catch (error) {
        console.log('Could not disable buttons on previous message:', error.message);
      }
    } catch (error) {
      console.error('Error disabling game buttons:', error);
    }
  }

  // Create disabled button components
  createDisabledButtons() {
    const quickBetRow1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('quickbet_tai_1000_disabled')
        .setLabel('🔴 TÀI 1K')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('quickbet_tai_5000_disabled')
        .setLabel('🔴 TÀI 5K')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('quickbet_tai_10000_disabled')
        .setLabel('🔴 TÀI 10K')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('quickbet_tai_50000_disabled')
        .setLabel('🔴 TÀI 50K')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    const quickBetRow2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('quickbet_xiu_1000_disabled')
        .setLabel('⚫ XỈU 1K')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('quickbet_xiu_5000_disabled')
        .setLabel('⚫ XỈU 5K')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('quickbet_xiu_10000_disabled')
        .setLabel('⚫ XỈU 10K')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('quickbet_xiu_50000_disabled')
        .setLabel('⚫ XỈU 50K')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    const quickBetRow3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('taixiu_analysis_disabled')
        .setLabel('🔮 Soi Cầu')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('taixiu_custom_disabled')
        .setLabel('🎯 Tùy Chỉnh')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    return [quickBetRow1, quickBetRow2, quickBetRow3];
  }

  // Create game buttons
  createGameButtons() {
    const quickBetRow1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('quickbet_tai_1000')
        .setLabel('🔴 TÀI 1K')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('quickbet_tai_5000')
        .setLabel('🔴 TÀI 5K')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('quickbet_tai_10000')
        .setLabel('🔴 TÀI 10K')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('quickbet_tai_50000')
        .setLabel('🔴 TÀI 50K')
        .setStyle(ButtonStyle.Danger)
    );

    const quickBetRow2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('quickbet_xiu_1000')
        .setLabel('⚫ XỈU 1K')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('quickbet_xiu_5000')
        .setLabel('⚫ XỈU 5K')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('quickbet_xiu_10000')
        .setLabel('⚫ XỈU 10K')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('quickbet_xiu_50000')
        .setLabel('⚫ XỈU 50K')
        .setStyle(ButtonStyle.Secondary)
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

    return [quickBetRow1, quickBetRow2, quickBetRow3];
  }

  // Place a bet
  async placeBet(guildId, userId, choice, amount) {
    try {
      const gameData = await TaiXiuGame.findOne({ guildId, isActive: true });
      if (!gameData || !gameData.bettingPhase) {
        throw new Error('Không thể đặt cược lúc này!');
      }

      // Check if user has enough coins
      const user = await User.findOne({ userId, guildId });
      if (!user || (user.coins || 0) < amount) {
        throw new Error('Không đủ tiền!');
      }

      // Check if user already has a bet this round
      const existingBet = await TaiXiuBet.findOne({
        guildId,
        userId,
        round: gameData.round,
        isActive: true
      });

      if (existingBet) {
        throw new Error('Bạn đã đặt cược ván này rồi!');
      }

      // Deduct coins
      user.coins = (user.coins || 0) - amount;
      await user.save();

      // Create bet
      const bet = new TaiXiuBet({
        guildId,
        userId,
        round: gameData.round,
        choice,
        amount
      });
      await bet.save();

      // Update game totals
      const updateField = choice === 'tai' ? 'totalBets.tai' : 'totalBets.xiu';
      const countField = choice === 'tai' ? 'playerCount.tai' : 'playerCount.xiu';
      
      await TaiXiuGame.findOneAndUpdate(
        { guildId },
        {
          $inc: {
            [updateField]: amount,
            [countField]: 1
          }
        }
      );

      return true;
    } catch (error) {
      throw error;
    }
  }

  // Get game state for a guild
  getGameState(guildId) {
    return this.activeGames.get(guildId);
  }

  // Get game data from database
  async getGameData(guildId) {
    return await TaiXiuGame.findOne({ guildId });
  }

  // Format currency helper
  formatCurrency(amount) {
    return formatCurrency(amount);
  }
}

export default TaiXiuGameManager;
