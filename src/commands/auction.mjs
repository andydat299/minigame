import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import User from '../models/User.mjs';
import { formatCurrency, successEmbed, errorEmbed } from './util.mjs';

export const data = new SlashCommandBuilder()
    .setName('auction')
    .setDescription('Hệ thống đấu giá')
    .addSubcommand(subcommand =>
        subcommand
            .setName('list')
            .setDescription('Xem các item đang đấu giá'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('sell')
            .setDescription('Đưa item lên đấu giá')
            .addStringOption(option =>
                option.setName('item')
                    .setDescription('Tên item muốn bán')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('quantity')
                    .setDescription('Số lượng')
                    .setRequired(true)
                    .setMinValue(1))
            .addIntegerOption(option =>
                option.setName('starting_price')
                    .setDescription('Giá khởi điểm')
                    .setRequired(true)
                    .setMinValue(100))
            .addIntegerOption(option =>
                option.setName('duration')
                    .setDescription('Thời gian đấu giá (giờ)')
                    .setRequired(false)
                    .setMinValue(1)
                    .setMaxValue(24)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('bid')
            .setDescription('Đặt giá cho item')
            .addStringOption(option =>
                option.setName('auction_id')
                    .setDescription('ID của phiên đấu giá')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('amount')
                    .setDescription('Số tiền đặt giá')
                    .setRequired(true)
                    .setMinValue(100)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('cancel')
            .setDescription('Hủy phiên đấu giá của bạn')
            .addStringOption(option =>
                option.setName('auction_id')
                    .setDescription('ID của phiên đấu giá')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('claim')
            .setDescription('Nhận item/tiền từ đấu giá kết thúc'));

// Global auction storage (in production, use database)
let auctions = new Map();
let auctionCounter = 1;

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
        case 'list':
            await handleList(interaction);
            break;
        case 'sell':
            await handleSell(interaction);
            break;
        case 'bid':
            await handleBid(interaction);
            break;
        case 'cancel':
            await handleCancel(interaction);
            break;
        case 'claim':
            await handleClaim(interaction);
            break;
    }
}

async function handleList(interaction) {
    const activeAuctions = Array.from(auctions.values()).filter(auction => 
        auction.endTime > Date.now() && !auction.completed
    );

    const embed = new EmbedBuilder()
        .setColor('#48dbfb')
        .setTitle('🏪 Nhà Đấu Giá')
        .setTimestamp();

    if (activeAuctions.length === 0) {
        embed.setDescription('Không có phiên đấu giá nào đang diễn ra.');
        return interaction.reply({ embeds: [embed] });
    }

    const auctionList = activeAuctions.slice(0, 10).map(auction => {
        const timeLeft = Math.ceil((auction.endTime - Date.now()) / (1000 * 60 * 60));
        const currentBid = auction.currentBid || auction.startingPrice;
        const bidder = auction.highestBidder ? `<@${auction.highestBidder}>` : 'Chưa có';
        
        return `**ID:** ${auction.id}\n**Item:** ${auction.itemName} x${auction.quantity}\n**Giá hiện tại:** ${formatCurrency(currentBid)}\n**Người đặt:** ${bidder}\n**Thời gian:** ${timeLeft}h\n`;
    });

    embed.setDescription(auctionList.join('\n'));
    embed.setFooter({ text: `Sử dụng /auction bid <id> <giá> để đặt giá` });

    await interaction.reply({ embeds: [embed] });
}

async function handleSell(interaction) {
    const itemName = interaction.options.getString('item');
    const quantity = interaction.options.getInteger('quantity');
    const startingPrice = interaction.options.getInteger('starting_price');
    const duration = interaction.options.getInteger('duration') || 12; // Default 12 hours
    
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    let profile = await User.findOne({ userId, guildId });
    if (!profile) profile = await User.create({ userId, guildId });

    // Check if user has the item
    const userItem = profile.inventory.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (!userItem || userItem.count < quantity) {
        return interaction.reply({ 
            embeds: [errorEmbed(`Bạn không có đủ **${itemName}** (có: ${userItem?.count || 0}, cần: ${quantity})`)], 
            ephemeral: true 
        });
    }

    // Check auction limit per user
    const userActiveAuctions = Array.from(auctions.values()).filter(auction => 
        auction.sellerId === userId && auction.endTime > Date.now() && !auction.completed
    );
    
    if (userActiveAuctions.length >= 3) {
        return interaction.reply({ 
            embeds: [errorEmbed('Bạn chỉ có thể có tối đa 3 phiên đấu giá cùng lúc!')], 
            ephemeral: true 
        });
    }

    // Remove item from inventory
    userItem.count -= quantity;
    if (userItem.count <= 0) {
        profile.inventory = profile.inventory.filter(i => i.name !== userItem.name);
    }
    await profile.save();

    // Create auction
    const auctionId = `A${auctionCounter++}`;
    const auction = {
        id: auctionId,
        sellerId: userId,
        sellerName: interaction.user.username,
        guildId: guildId,
        itemName: itemName,
        quantity: quantity,
        startingPrice: startingPrice,
        currentBid: null,
        highestBidder: null,
        highestBidderName: null,
        endTime: Date.now() + (duration * 60 * 60 * 1000),
        completed: false,
        bids: []
    };

    auctions.set(auctionId, auction);

    // Schedule auto-complete
    setTimeout(() => {
        completeAuction(auctionId);
    }, duration * 60 * 60 * 1000);

    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🏪 Đấu Giá Đã Tạo')
        .setDescription(`**${itemName}** x${quantity} đã được đưa lên đấu giá!`)
        .addFields(
            { name: '🆔 ID', value: auctionId, inline: true },
            { name: '💰 Giá Khởi Điểm', value: formatCurrency(startingPrice), inline: true },
            { name: '⏰ Thời Gian', value: `${duration} giờ`, inline: true }
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleBid(interaction) {
    const auctionId = interaction.options.getString('auction_id').toUpperCase();
    const bidAmount = interaction.options.getInteger('amount');
    
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    let profile = await User.findOne({ userId, guildId });
    if (!profile) profile = await User.create({ userId, guildId });

    const auction = auctions.get(auctionId);
    if (!auction) {
        return interaction.reply({ 
            embeds: [errorEmbed('Không tìm thấy phiên đấu giá với ID này!')], 
            ephemeral: true 
        });
    }

    if (auction.completed || auction.endTime <= Date.now()) {
        return interaction.reply({ 
            embeds: [errorEmbed('Phiên đấu giá này đã kết thúc!')], 
            ephemeral: true 
        });
    }

    if (auction.sellerId === userId) {
        return interaction.reply({ 
            embeds: [errorEmbed('Bạn không thể đặt giá cho phiên đấu giá của chính mình!')], 
            ephemeral: true 
        });
    }

    const currentHighest = auction.currentBid || auction.startingPrice;
    const minBid = Math.ceil(currentHighest * 1.05); // Minimum 5% increase

    if (bidAmount < minBid) {
        return interaction.reply({ 
            embeds: [errorEmbed(`Giá đặt phải ít nhất ${formatCurrency(minBid)} (tăng 5% so với giá hiện tại)`)], 
            ephemeral: true 
        });
    }

    if ((profile.coins || 0) < bidAmount) {
        return interaction.reply({ 
            embeds: [errorEmbed(`Bạn không đủ tiền! Cần ${formatCurrency(bidAmount)}, có ${formatCurrency(profile.coins || 0)}`)], 
            ephemeral: true 
        });
    }

    // Return money to previous highest bidder
    if (auction.highestBidder) {
        const prevBidder = await User.findOne({ userId: auction.highestBidder, guildId });
        if (prevBidder) {
            prevBidder.coins = (prevBidder.coins || 0) + auction.currentBid;
            await prevBidder.save();
        }
    }

    // Deduct money from new bidder
    profile.coins = (profile.coins || 0) - bidAmount;
    await profile.save();

    // Update auction
    auction.currentBid = bidAmount;
    auction.highestBidder = userId;
    auction.highestBidderName = interaction.user.username;
    auction.bids.push({
        bidderId: userId,
        bidderName: interaction.user.username,
        amount: bidAmount,
        timestamp: Date.now()
    });

    const timeLeft = Math.ceil((auction.endTime - Date.now()) / (1000 * 60 * 60));

    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🎯 Đặt Giá Thành Công')
        .setDescription(`Bạn đã đặt giá ${formatCurrency(bidAmount)} cho **${auction.itemName}** x${auction.quantity}`)
        .addFields(
            { name: '🆔 ID', value: auctionId, inline: true },
            { name: '⏰ Thời Gian Còn Lại', value: `${timeLeft} giờ`, inline: true },
            { name: '🏆 Trạng Thái', value: 'Đang dẫn đầu', inline: true }
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleCancel(interaction) {
    const auctionId = interaction.options.getString('auction_id').toUpperCase();
    const userId = interaction.user.id;
    
    const auction = auctions.get(auctionId);
    if (!auction) {
        return interaction.reply({ 
            embeds: [errorEmbed('Không tìm thấy phiên đấu giá với ID này!')], 
            ephemeral: true 
        });
    }

    if (auction.sellerId !== userId) {
        return interaction.reply({ 
            embeds: [errorEmbed('Bạn chỉ có thể hủy phiên đấu giá của chính mình!')], 
            ephemeral: true 
        });
    }

    if (auction.currentBid) {
        return interaction.reply({ 
            embeds: [errorEmbed('Không thể hủy phiên đấu giá đã có người đặt giá!')], 
            ephemeral: true 
        });
    }

    // Return item to seller
    let profile = await User.findOne({ userId, guildId: auction.guildId });
    if (profile) {
        const item = profile.inventory.find(i => i.name === auction.itemName);
        if (item) item.count += auction.quantity;
        else profile.inventory.push({ name: auction.itemName, count: auction.quantity });
        await profile.save();
    }

    auctions.delete(auctionId);

    const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Đấu Giá Đã Hủy')
        .setDescription(`Phiên đấu giá **${auction.itemName}** x${auction.quantity} đã được hủy và item đã trả về.`)
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleClaim(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    // Find completed auctions for this user
    const completedAuctions = Array.from(auctions.values()).filter(auction => 
        auction.completed && 
        auction.guildId === guildId &&
        (auction.sellerId === userId || auction.highestBidder === userId) &&
        !auction.claimed
    );

    if (completedAuctions.length === 0) {
        return interaction.reply({ 
            embeds: [errorEmbed('Không có phiên đấu giá nào để nhận!')], 
            ephemeral: true 
        });
    }

    let profile = await User.findOne({ userId, guildId });
    if (!profile) profile = await User.create({ userId, guildId });

    const claimedItems = [];
    let totalCoins = 0;

    for (const auction of completedAuctions) {
        if (auction.sellerId === userId) {
            // Seller gets the money
            totalCoins += auction.currentBid || 0;
        } else if (auction.highestBidder === userId) {
            // Winner gets the item
            const item = profile.inventory.find(i => i.name === auction.itemName);
            if (item) item.count += auction.quantity;
            else profile.inventory.push({ name: auction.itemName, count: auction.quantity });
            claimedItems.push(`${auction.itemName} x${auction.quantity}`);
        }
        auction.claimed = true;
    }

    profile.coins = (profile.coins || 0) + totalCoins;
    await profile.save();

    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('📦 Đã Nhận Phần Thưởng')
        .setTimestamp();

    let description = '';
    if (totalCoins > 0) {
        description += `💰 Nhận được: ${formatCurrency(totalCoins)}\n`;
    }
    if (claimedItems.length > 0) {
        description += `📦 Items: ${claimedItems.join(', ')}`;
    }

    embed.setDescription(description);
    embed.addFields({ name: '🪙 Total Coins', value: formatCurrency(profile.coins), inline: true });

    await interaction.reply({ embeds: [embed] });
}

async function completeAuction(auctionId) {
    const auction = auctions.get(auctionId);
    if (!auction || auction.completed) return;

    auction.completed = true;
    
    // If no bids, return item to seller
    if (!auction.currentBid) {
        let profile = await User.findOne({ userId: auction.sellerId, guildId: auction.guildId });
        if (profile) {
            const item = profile.inventory.find(i => i.name === auction.itemName);
            if (item) item.count += auction.quantity;
            else profile.inventory.push({ name: auction.itemName, count: auction.quantity });
            await profile.save();
        }
    }
}