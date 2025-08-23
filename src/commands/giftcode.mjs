import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import User from '../models/User.mjs';
import Giftcode from '../models/Giftcode.mjs';
import { formatCurrency, errorEmbed, successEmbed } from './util.mjs';

export const data = new SlashCommandBuilder()
    .setName('giftcode')
    .setDescription('Hệ thống giftcode')
    .addSubcommand(subcommand =>
        subcommand
            .setName('redeem')
            .setDescription('Sử dụng giftcode')
            .addStringOption(option =>
                option.setName('code')
                    .setDescription('Mã giftcode')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('create')
            .setDescription('Tạo giftcode mới (Admin only)')
            .addStringOption(option =>
                option.setName('code')
                    .setDescription('Mã giftcode (để trống để tự động tạo)')
                    .setRequired(false))
            .addIntegerOption(option =>
                option.setName('coins')
                    .setDescription('Số xu thưởng')
                    .setRequired(false)
                    .setMinValue(0))
            .addIntegerOption(option =>
                option.setName('bait')
                    .setDescription('Số mồi thưởng')
                    .setRequired(false)
                    .setMinValue(0))
            .addIntegerOption(option =>
                option.setName('free_fishing')
                    .setDescription('Số lần câu miễn phí')
                    .setRequired(false)
                    .setMinValue(0))
            .addIntegerOption(option =>
                option.setName('max_uses')
                    .setDescription('Số lần sử dụng tối đa (-1 = không giới hạn)')
                    .setRequired(false)
                    .setMinValue(-1))
            .addStringOption(option =>
                option.setName('expires')
                    .setDescription('Thời gian hết hạn (ví dụ: 7d, 24h, 30m)')
                    .setRequired(false))
            .addStringOption(option =>
                option.setName('description')
                    .setDescription('Mô tả giftcode')
                    .setRequired(false)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('list')
            .setDescription('Xem danh sách giftcode (Admin only)'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('delete')
            .setDescription('Xóa giftcode (Admin only)')
            .addStringOption(option =>
                option.setName('code')
                    .setDescription('Mã giftcode cần xóa')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('info')
            .setDescription('Xem thông tin giftcode')
            .addStringOption(option =>
                option.setName('code')
                    .setDescription('Mã giftcode')
                    .setRequired(true)));

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
        case 'redeem':
            await handleRedeem(interaction);
            break;
        case 'create':
            await handleCreate(interaction);
            break;
        case 'list':
            await handleList(interaction);
            break;
        case 'delete':
            await handleDelete(interaction);
            break;
        case 'info':
            await handleInfo(interaction);
            break;
    }
}

async function handleRedeem(interaction) {
    const code = interaction.options.getString('code').toUpperCase();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    // Find giftcode
    const giftcode = await Giftcode.findOne({ code, guildId, isActive: true });
    if (!giftcode) {
        return interaction.reply({
            embeds: [errorEmbed('❌ Giftcode không tồn tại hoặc đã hết hạn!')],
            ephemeral: true
        });
    }
    
    // Check expiration
    if (giftcode.expiresAt && giftcode.expiresAt < new Date()) {
        giftcode.isActive = false;
        await giftcode.save();
        return interaction.reply({
            embeds: [errorEmbed('⏰ Giftcode đã hết hạn!')],
            ephemeral: true
        });
    }
    
    // Check max uses
    if (giftcode.maxUses !== -1 && giftcode.currentUses >= giftcode.maxUses) {
        return interaction.reply({
            embeds: [errorEmbed('🚫 Giftcode đã hết lượt sử dụng!')],
            ephemeral: true
        });
    }
    
    // Check if user already used
    if (giftcode.oneTimePerUser && giftcode.usedBy.includes(userId)) {
        return interaction.reply({
            embeds: [errorEmbed('🔄 Bạn đã sử dụng giftcode này rồi!')],
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
    
    // Handle items
    if (giftcode.rewards.items && giftcode.rewards.items.size > 0) {
        for (const [itemName, quantity] of giftcode.rewards.items) {
            const currentQty = profile.items?.get(itemName) || 0;
            profile.items.set(itemName, currentQty + quantity);
            rewards.push(`📦 ${quantity}x ${itemName}`);
        }
    }
    
    await profile.save();
    
    // Update giftcode usage
    giftcode.currentUses += 1;
    giftcode.usedBy.push(userId);
    await giftcode.save();
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🎉 Giftcode Đã Được Sử dụng!')
        .setDescription(`**Mã: \`${code}\`**\n${giftcode.description || 'Không có mô tả'}`)
        .addFields(
            { name: '🎁 Phần thưởng nhận được', value: rewards.join('\n') || 'Không có', inline: false },
            { name: '💰 Tổng xu hiện tại', value: formatCurrency(profile.coins), inline: true },
            { name: '🪱 Tổng mồi hiện tại', value: `${profile.bait || 0}`, inline: true },
            { name: '🎁 Lần câu miễn phí', value: `${profile.freeFishingTries || 0}`, inline: true }
        )
        .setFooter({ text: 'Chúc mừng bạn!' })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

async function handleCreate(interaction) {
    // Check admin permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
            embeds: [errorEmbed('❌ Bạn cần quyền Administrator để sử dụng lệnh này!')],
            ephemeral: true
        });
    }
    
    const guildId = interaction.guildId;
    const createdBy = interaction.user.id;
    
    // Get options
    let code = interaction.options.getString('code');
    const coins = interaction.options.getInteger('coins') || 0;
    const bait = interaction.options.getInteger('bait') || 0;
    const freeFishing = interaction.options.getInteger('free_fishing') || 0;
    const maxUses = interaction.options.getInteger('max_uses') || 1;
    const expiresInput = interaction.options.getString('expires');
    const description = interaction.options.getString('description') || '';
    
    // Generate random code if not provided
    if (!code) {
        code = generateRandomCode();
    } else {
        code = code.toUpperCase();
    }
    
    // Check if code already exists
    const existingCode = await Giftcode.findOne({ code, guildId });
    if (existingCode) {
        return interaction.reply({
            embeds: [errorEmbed('❌ Giftcode này đã tồn tại!')],
            ephemeral: true
        });
    }
    
    // Parse expiration
    let expiresAt = null;
    if (expiresInput) {
        expiresAt = parseExpiration(expiresInput);
        if (!expiresAt) {
            return interaction.reply({
                embeds: [errorEmbed('❌ Định dạng thời gian không hợp lệ! (Ví dụ: 7d, 24h, 30m)')],
                ephemeral: true
            });
        }
    }
    
    // Create giftcode
    const giftcode = await Giftcode.create({
        code,
        guildId,
        createdBy,
        rewards: {
            coins,
            bait,
            freeFishingTries: freeFishing
        },
        maxUses,
        expiresAt,
        description
    });
    
    const rewardsList = [];
    if (coins > 0) rewardsList.push(`💰 ${formatCurrency(coins)}`);
    if (bait > 0) rewardsList.push(`🪱 ${bait} mồi`);
    if (freeFishing > 0) rewardsList.push(`🎁 ${freeFishing} lần câu miễn phí`);
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Giftcode Đã Được Tạo!')
        .addFields(
            { name: '🏷️ Mã', value: `\`${code}\``, inline: true },
            { name: '🎁 Phần thưởng', value: rewardsList.join('\n') || 'Không có', inline: true },
            { name: '🔢 Lượt sử dụng', value: maxUses === -1 ? 'Không giới hạn' : `${maxUses}`, inline: true },
            { name: '⏰ Hết hạn', value: expiresAt ? `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>` : 'Không bao giờ', inline: true },
            { name: '📝 Mô tả', value: description || 'Không có', inline: false }
        )
        .setFooter({ text: 'Chia sẻ mã này cho thành viên!' })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

async function handleList(interaction) {
    // Check admin permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
            embeds: [errorEmbed('❌ Bạn cần quyền Administrator để sử dụng lệnh này!')],
            ephemeral: true
        });
    }
    
    const guildId = interaction.guildId;
    const giftcodes = await Giftcode.find({ guildId }).sort({ createdAt: -1 }).limit(10);
    
    if (giftcodes.length === 0) {
        return interaction.reply({
            embeds: [errorEmbed('📭 Chưa có giftcode nào!')],
            ephemeral: true
        });
    }
    
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📋 Danh Sách Giftcode')
        .setDescription('10 giftcode gần nhất:')
        .setTimestamp();
    
    for (const giftcode of giftcodes) {
        const status = giftcode.isActive ? 
            (giftcode.expiresAt && giftcode.expiresAt < new Date() ? '⏰ Hết hạn' : '✅ Hoạt động') : 
            '❌ Vô hiệu';
        
        const usage = giftcode.maxUses === -1 ? 
            `${giftcode.currentUses}/∞` : 
            `${giftcode.currentUses}/${giftcode.maxUses}`;
        
        const rewards = [];
        if (giftcode.rewards.coins > 0) rewards.push(`${formatCurrency(giftcode.rewards.coins)}`);
        if (giftcode.rewards.bait > 0) rewards.push(`${giftcode.rewards.bait} mồi`);
        if (giftcode.rewards.freeFishingTries > 0) rewards.push(`${giftcode.rewards.freeFishingTries} free`);
        
        embed.addFields({
            name: `\`${giftcode.code}\` ${status}`,
            value: `🎁 ${rewards.join(', ') || 'Không có'}\n📊 Sử dụng: ${usage}\n📝 ${giftcode.description || 'Không có mô tả'}`,
            inline: true
        });
    }
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDelete(interaction) {
    // Check admin permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
            embeds: [errorEmbed('❌ Bạn cần quyền Administrator để sử dụng lệnh này!')],
            ephemeral: true
        });
    }
    
    const code = interaction.options.getString('code').toUpperCase();
    const guildId = interaction.guildId;
    
    const giftcode = await Giftcode.findOneAndDelete({ code, guildId });
    if (!giftcode) {
        return interaction.reply({
            embeds: [errorEmbed('❌ Không tìm thấy giftcode!')],
            ephemeral: true
        });
    }
    
    await interaction.reply({
        embeds: [successEmbed(`✅ Đã xóa giftcode \`${code}\`!`)],
        ephemeral: true
    });
}

async function handleInfo(interaction) {
    const code = interaction.options.getString('code').toUpperCase();
    const guildId = interaction.guildId;
    
    const giftcode = await Giftcode.findOne({ code, guildId });
    if (!giftcode) {
        return interaction.reply({
            embeds: [errorEmbed('❌ Giftcode không tồn tại!')],
            ephemeral: true
        });
    }
    
    const status = giftcode.isActive ? 
        (giftcode.expiresAt && giftcode.expiresAt < new Date() ? '⏰ Hết hạn' : '✅ Hoạt động') : 
        '❌ Vô hiệu';
    
    const usage = giftcode.maxUses === -1 ? 
        `${giftcode.currentUses}/∞` : 
        `${giftcode.currentUses}/${giftcode.maxUses}`;
    
    const rewards = [];
    if (giftcode.rewards.coins > 0) rewards.push(`💰 ${formatCurrency(giftcode.rewards.coins)}`);
    if (giftcode.rewards.bait > 0) rewards.push(`🪱 ${giftcode.rewards.bait} mồi`);
    if (giftcode.rewards.freeFishingTries > 0) rewards.push(`🎁 ${giftcode.rewards.freeFishingTries} lần câu miễn phí`);
    
    const embed = new EmbedBuilder()
        .setColor(giftcode.isActive ? '#00ff00' : '#ff6b6b')
        .setTitle(`🏷️ Thông Tin Giftcode: \`${code}\``)
        .addFields(
            { name: '📊 Trạng thái', value: status, inline: true },
            { name: '🔢 Sử dụng', value: usage, inline: true },
            { name: '⏰ Hết hạn', value: giftcode.expiresAt ? `<t:${Math.floor(giftcode.expiresAt.getTime() / 1000)}:R>` : 'Không bao giờ', inline: true },
            { name: '🎁 Phần thưởng', value: rewards.join('\n') || 'Không có', inline: false },
            { name: '📝 Mô tả', value: giftcode.description || 'Không có', inline: false }
        )
        .setFooter({ text: `Tạo bởi: ${giftcode.createdBy}` })
        .setTimestamp(giftcode.createdAt);
    
    await interaction.reply({ embeds: [embed] });
}

// Helper functions
function generateRandomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function parseExpiration(input) {
    const match = input.match(/^(\d+)([dhm])$/);
    if (!match) return null;
    
    const amount = parseInt(match[1]);
    const unit = match[2];
    
    const now = new Date();
    switch (unit) {
        case 'd':
            return new Date(now.getTime() + amount * 24 * 60 * 60 * 1000);
        case 'h':
            return new Date(now.getTime() + amount * 60 * 60 * 1000);
        case 'm':
            return new Date(now.getTime() + amount * 60 * 1000);
        default:
            return null;
    }
}