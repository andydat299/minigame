import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import User from '../models/User.mjs';
import { formatCurrency, errorEmbed } from './util.mjs';

export const data = new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Chơi Blackjack (21 điểm)')
    .addIntegerOption(option =>
        option.setName('bet')
            .setDescription('Số tiền cược')
            .setRequired(true)
            .setMinValue(100));

export async function execute(interaction) {
    const bet = interaction.options.getInteger('bet');
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    let profile = await User.findOne({ userId, guildId });
    if (!profile) profile = await User.create({ userId, guildId });
    
    if ((profile.coins || 0) < bet) {
        return interaction.reply({
            embeds: [errorEmbed(`Bạn không đủ tiền để cược ${formatCurrency(bet)}!`)],
            ephemeral: true
        });
    }
    
    // Create deck and deal cards
    const deck = createDeck();
    const playerCards = [drawCard(deck), drawCard(deck)];
    const dealerCards = [drawCard(deck), drawCard(deck)];
    
    const playerScore = calculateScore(playerCards);
    const dealerVisibleScore = calculateScore([dealerCards[0]]);
    
    // Check for natural blackjack
    if (playerScore === 21) {
        const dealerScore = calculateScore(dealerCards);
        if (dealerScore === 21) {
            // Push - tie
            const embed = new EmbedBuilder()
                .setColor('#feca57')
                .setTitle('🃏 Blackjack - Hòa!')
                .addFields(
                    { name: '🎴 Bài của bạn', value: formatCards(playerCards) + ` = **${playerScore}**`, inline: true },
                    { name: '🎭 Bài dealer', value: formatCards(dealerCards) + ` = **${dealerScore}**`, inline: true },
                    { name: '💰 Kết quả', value: `Hòa! Tiền cược được hoàn lại.`, inline: false }
                )
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed] });
        } else {
            // Player blackjack wins
            const winAmount = Math.floor(bet * 1.5); // Blackjack pays 3:2
            profile.coins += winAmount;
            await profile.save();
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🃏 Blackjack - BLACKJACK!')
                .addFields(
                    { name: '🎴 Bài của bạn', value: formatCards(playerCards) + ` = **${playerScore}** ♠️`, inline: true },
                    { name: '🎭 Bài dealer', value: formatCards([dealerCards[0], '❓']) + ` = **${dealerVisibleScore}+**`, inline: true },
                    { name: '💰 Kết quả', value: `BLACKJACK! Thắng ${formatCurrency(winAmount)}!`, inline: false }
                )
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed] });
        }
    }
    
    // Store game state in custom ID
    const gameState = {
        deck: deck,
        playerCards: playerCards,
        dealerCards: dealerCards,
        bet: bet,
        userId: userId,
        guildId: guildId
    };
    
    const gameId = Buffer.from(JSON.stringify(gameState)).toString('base64').substring(0, 80);
    
    const embed = new EmbedBuilder()
        .setColor('#48dbfb')
        .setTitle('🃏 Blackjack')
        .addFields(
            { name: '🎴 Bài của bạn', value: formatCards(playerCards) + ` = **${playerScore}**`, inline: true },
            { name: '🎭 Bài dealer', value: formatCards([dealerCards[0], '❓']) + ` = **${dealerVisibleScore}+**`, inline: true },
            { name: '💰 Tiền cược', value: formatCurrency(bet), inline: true }
        )
        .setFooter({ text: 'Chọn hành động của bạn!' })
        .setTimestamp();
    
    const hitButton = new ButtonBuilder()
        .setCustomId(`bj_hit_${Date.now()}`)
        .setLabel('🎯 Hit')
        .setStyle(ButtonStyle.Primary);
    
    const standButton = new ButtonBuilder()
        .setCustomId(`bj_stand_${Date.now()}`)
        .setLabel('🛑 Stand')
        .setStyle(ButtonStyle.Secondary);
    
    const doubleButton = new ButtonBuilder()
        .setCustomId(`bj_double_${Date.now()}`)
        .setLabel('⚡ Double')
        .setStyle(ButtonStyle.Success);
    
    const row = new ActionRowBuilder().addComponents(hitButton, standButton, doubleButton);
    
    // Store game state temporarily (in real app, use Redis or database)
    global.blackjackGames = global.blackjackGames || new Map();
    global.blackjackGames.set(userId, gameState);
    
    await interaction.reply({ embeds: [embed], components: [row] });
}

// Card game functions
function createDeck() {
    const suits = ['♠️', '♥️', '♦️', '♣️'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];
    
    for (const suit of suits) {
        for (const value of values) {
            deck.push({ suit, value });
        }
    }
    
    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    return deck;
}

function drawCard(deck) {
    return deck.pop();
}

function calculateScore(cards) {
    let score = 0;
    let aces = 0;
    
    for (const card of cards) {
        if (card.value === 'A') {
            aces++;
            score += 11;
        } else if (['J', 'Q', 'K'].includes(card.value)) {
            score += 10;
        } else {
            score += parseInt(card.value);
        }
    }
    
    // Handle aces
    while (score > 21 && aces > 0) {
        score -= 10;
        aces--;
    }
    
    return score;
}

function formatCards(cards) {
    return cards.map(card => {
        if (card === '❓') return '❓';
        return `${card.value}${card.suit}`;
    }).join(' ');
}

// Export game functions for button handlers
export { calculateScore, formatCards, drawCard };