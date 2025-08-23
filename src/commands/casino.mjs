import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import User from '../models/User.mjs';
import { formatCurrency, successEmbed, errorEmbed } from './util.mjs';

export const data = new SlashCommandBuilder()
    .setName('casino')
    .setDescription('Các trò chơi casino')
    .addSubcommand(subcommand =>
        subcommand
            .setName('slots')
            .setDescription('Chơi máy đánh bạc')
            .addIntegerOption(option =>
                option.setName('bet')
                    .setDescription('Số tiền cược')
                    .setRequired(true)
                    .setMinValue(100)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('coinflip')
            .setDescription('Tung đồng xu')
            .addIntegerOption(option =>
                option.setName('bet')
                    .setDescription('Số tiền cược')
                    .setRequired(true)
                    .setMinValue(100))
            .addStringOption(option =>
                option.setName('choice')
                    .setDescription('Chọn mặt')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Ngửa', value: 'heads' },
                        { name: 'Sấp', value: 'tails' }
                    )))
    .addSubcommand(subcommand =>
        subcommand
            .setName('dice')
            .setDescription('Tung xúc xắc (đoán tổng 2 xúc xắc)')
            .addIntegerOption(option =>
                option.setName('bet')
                    .setDescription('Số tiền cược')
                    .setRequired(true)
                    .setMinValue(100))
            .addIntegerOption(option =>
                option.setName('guess')
                    .setDescription('Đoán tổng (2-12)')
                    .setRequired(true)
                    .setMinValue(2)
                    .setMaxValue(12)));

const SLOT_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎'];
const SLOT_PAYOUTS = {
    '💎💎💎': 50,  // x50
    '⭐⭐⭐': 25,   // x25
    '🍇🍇🍇': 15,   // x15
    '🍊🍊🍊': 10,   // x10
    '🍋🍋🍋': 8,    // x8
    '🍒🍒🍒': 5,    // x5
    'two_match': 2  // x2 for any two matching
};

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
        case 'slots':
            await handleSlots(interaction);
            break;
        case 'coinflip':
            await handleCoinFlip(interaction);
            break;
        case 'dice':
            await handleDice(interaction);
            break;
    }
}

async function handleSlots(interaction) {
    const bet = interaction.options.getInteger('bet');
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    let profile = await User.findOne({ userId, guildId });
    if (!profile) profile = await User.create({ userId, guildId });

    if ((profile.coins || 0) < bet) {
        return interaction.reply({ 
            embeds: [errorEmbed(`Bạn không đủ tiền! Cần ${formatCurrency(bet)}, có ${formatCurrency(profile.coins || 0)}`)], 
            ephemeral: true 
        });
    }

    // Spin the slots
    const result = [
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]
    ];

    // Calculate payout
    let multiplier = 0;
    const resultString = result.join('');
    
    if (SLOT_PAYOUTS[resultString]) {
        multiplier = SLOT_PAYOUTS[resultString];
    } else if (result[0] === result[1] || result[1] === result[2] || result[0] === result[2]) {
        multiplier = SLOT_PAYOUTS.two_match;
    }

    const winAmount = bet * multiplier;
    const netGain = winAmount - bet;

    // Update profile
    profile.coins = (profile.coins || 0) - bet + winAmount;
    profile.totalGambled = (profile.totalGambled || 0) + bet;
    if (winAmount > bet) {
        profile.totalWon = (profile.totalWon || 0) + netGain;
    }
    await profile.save();

    // Create result embed
    const embed = new EmbedBuilder()
        .setTitle('🎰 Máy Đánh Bạc')
        .setDescription(`**[ ${result.join(' | ')} ]**`)
        .addFields(
            { name: '💰 Cược', value: formatCurrency(bet), inline: true },
            { name: '🎯 Kết Quả', value: winAmount > bet ? `Thắng ${formatCurrency(netGain)}` : 'Thua', inline: true },
            { name: '🪙 Coins', value: formatCurrency(profile.coins), inline: true }
        )
        .setTimestamp();

    if (winAmount > bet) {
        embed.setColor('#00ff00');
        if (multiplier >= 25) {
            embed.setDescription(`🎉 **JACKPOT!** 🎉\n**[ ${result.join(' | ')} ]**`);
        }
    } else {
        embed.setColor('#ff6b6b');
    }

    await interaction.reply({ embeds: [embed] });
}

async function handleCoinFlip(interaction) {
    const bet = interaction.options.getInteger('bet');
    const choice = interaction.options.getString('choice');
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    let profile = await User.findOne({ userId, guildId });
    if (!profile) profile = await User.create({ userId, guildId });

    if ((profile.coins || 0) < bet) {
        return interaction.reply({ 
            embeds: [errorEmbed(`Bạn không đủ tiền! Cần ${formatCurrency(bet)}, có ${formatCurrency(profile.coins || 0)}`)], 
            ephemeral: true 
        });
    }

    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = choice === result;
    const winAmount = won ? bet * 2 : 0;
    const netGain = winAmount - bet;

    // Update profile
    profile.coins = (profile.coins || 0) - bet + winAmount;
    profile.totalGambled = (profile.totalGambled || 0) + bet;
    if (won) {
        profile.totalWon = (profile.totalWon || 0) + netGain;
    }
    await profile.save();

    const resultEmoji = result === 'heads' ? '👑' : '⚡';
    const choiceEmoji = choice === 'heads' ? '👑' : '⚡';
    const resultText = result === 'heads' ? 'Ngửa' : 'Sấp';
    const choiceText = choice === 'heads' ? 'Ngửa' : 'Sấp';

    const embed = new EmbedBuilder()
        .setTitle('🪙 Tung Đồng Xu')
        .setColor(won ? '#00ff00' : '#ff6b6b')
        .setDescription(`${resultEmoji} Kết quả: **${resultText}**`)
        .addFields(
            { name: '🎯 Dự Đoán', value: `${choiceEmoji} ${choiceText}`, inline: true },
            { name: '💰 Cược', value: formatCurrency(bet), inline: true },
            { name: '📊 Kết Quả', value: won ? `Thắng ${formatCurrency(netGain)}` : 'Thua', inline: true },
            { name: '🪙 Coins', value: formatCurrency(profile.coins), inline: false }
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleDice(interaction) {
    const bet = interaction.options.getInteger('bet');
    const guess = interaction.options.getInteger('guess');
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    let profile = await User.findOne({ userId, guildId });
    if (!profile) profile = await User.create({ userId, guildId });

    if ((profile.coins || 0) < bet) {
        return interaction.reply({ 
            embeds: [errorEmbed(`Bạn không đủ tiền! Cần ${formatCurrency(bet)}, có ${formatCurrency(profile.coins || 0)}`)], 
            ephemeral: true 
        });
    }

    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const total = dice1 + dice2;
    const won = guess === total;

    // Calculate multiplier based on probability
    const multipliers = { 2: 35, 3: 17, 4: 11, 5: 8, 6: 6, 7: 5, 8: 6, 9: 8, 10: 11, 11: 17, 12: 35 };
    const winAmount = won ? bet * multipliers[guess] : 0;
    const netGain = winAmount - bet;

    // Update profile
    profile.coins = (profile.coins || 0) - bet + winAmount;
    profile.totalGambled = (profile.totalGambled || 0) + bet;
    if (won) {
        profile.totalWon = (profile.totalWon || 0) + netGain;
    }
    await profile.save();

    const embed = new EmbedBuilder()
        .setTitle('🎲 Tung Xúc Xắc')
        .setColor(won ? '#00ff00' : '#ff6b6b')
        .setDescription(`🎲 **${dice1}** + 🎲 **${dice2}** = **${total}**`)
        .addFields(
            { name: '🎯 Dự Đoán', value: `${guess}`, inline: true },
            { name: '💰 Cược', value: formatCurrency(bet), inline: true },
            { name: '📊 Kết Quả', value: won ? `Thắng ${formatCurrency(netGain)} (x${multipliers[guess]})` : 'Thua', inline: true },
            { name: '🪙 Coins', value: formatCurrency(profile.coins), inline: false }
        )
        .setTimestamp();

    if (won && multipliers[guess] >= 17) {
        embed.setDescription(`🎉 **LUCKY!** 🎉\n🎲 **${dice1}** + 🎲 **${dice2}** = **${total}**`);
    }

    await interaction.reply({ embeds: [embed] });
}