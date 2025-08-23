import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { code, formatCurrency } from './util.mjs';

export const data = new SlashCommandBuilder()
    .setName('sukiencauca')
    .setDescription('Tham gia sự kiện câu cá đặc biệt')
    .addSubcommand(subcommand =>
        subcommand
            .setName('thamgia')
            .setDescription('Tham gia sự kiện câu cá hiện tại'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('trangthai')
            .setDescription('Kiểm tra trạng thái sự kiện câu cá'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('bxh')
            .setDescription('Xem bảng xếp hạng sự kiện câu cá'));

// Global fishing event state
let currentEvent = null;
let eventParticipants = new Map();

// Event types with different rewards and durations
const eventTypes = [
    {
        name: "Giờ Vàng",
        description: "Giá trị cá tăng gấp đôi và tỷ lệ câu cá hiếm cao!",
        duration: 30 * 60 * 1000, // 30 minutes
        multiplier: 2,
        rareChance: 0.3
    },
    {
        name: "Săn Kho Báu",
        description: "Tìm thấy kho báu ẩn giấu khi câu cá!",
        duration: 45 * 60 * 1000, // 45 minutes
        multiplier: 1.5,
        treasureChance: 0.2
    },
    {
        name: "Bão Cá",
        description: "Tỷ lệ câu được cá tăng gấp ba!",
        duration: 20 * 60 * 1000, // 20 minutes
        multiplier: 1.2,
        catchBonus: 3
    }
];

export async function execute(interaction) {
    // Dynamic import database when needed
    let getUser, updateUser;
    try {
        const db = await import('../database.mjs');
        getUser = db.getUser;
        updateUser = db.updateUser;
    } catch (error) {
        return interaction.reply({ content: 'Database không khả dụng!', ephemeral: true });
    }
    
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'thamgia') {
        await handleJoin(interaction);
    } else if (subcommand === 'trangthai') {
        await handleStatus(interaction);
    } else if (subcommand === 'bxh') {
        await handleLeaderboard(interaction);
    }
}

async function handleJoin(interaction) {
    if (!currentEvent) {
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('🎣 Không Có Sự Kiện')
            .setDescription('Hiện tại không có sự kiện câu cá nào đang diễn ra. Sự kiện sẽ bắt đầu ngẫu nhiên trong ngày!')
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
    }
    
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    
    if (eventParticipants.has(userId)) {
        const embed = new EmbedBuilder()
            .setColor('#feca57')
            .setTitle('🎣 Đã Tham Gia')
            .setDescription('Bạn đã tham gia sự kiện câu cá hiện tại rồi!')
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    eventParticipants.set(userId, {
        guildId,
        joinTime: Date.now(),
        catches: 0,
        totalValue: 0,
        specialCatches: []
    });
    
    const embed = new EmbedBuilder()
        .setColor('#48dbfb')
        .setTitle('🎣 Đã Tham Gia Sự Kiện!')
        .setDescription(`Chào mừng đến với **${currentEvent.name}**!\n\n${currentEvent.description}\n\nThời gian còn lại: ${code(formatTime(currentEvent.endTime - Date.now()))}`)
        .addFields(
            { name: '💰 Hệ Số Thưởng', value: `${currentEvent.multiplier}x`, inline: true },
            { name: '👥 Người Tham Gia', value: `${eventParticipants.size}`, inline: true }
        )
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

async function handleStatus(interaction) {
    if (!currentEvent) {
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('🎣 Không Có Sự Kiện')
            .setDescription('Hiện tại không có sự kiện câu cá nào đang diễn ra. Sự kiện sẽ bắt đầu ngẫu nhiên trong ngày!')
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
    }
    
    const timeRemaining = currentEvent.endTime - Date.now();
    const userId = interaction.user.id;
    const userStats = eventParticipants.get(userId);
    
    const embed = new EmbedBuilder()
        .setColor('#48dbfb')
        .setTitle(`🎣 ${currentEvent.name}`)
        .setDescription(currentEvent.description)
        .addFields(
            { name: '⏰ Thời Gian Còn Lại', value: code(formatTime(timeRemaining)), inline: true },
            { name: '👥 Người Tham Gia', value: `${eventParticipants.size}`, inline: true },
            { name: '💰 Hệ Số Nhân', value: `${currentEvent.multiplier}x`, inline: true }
        )
        .setTimestamp();
    
    if (userStats) {
        embed.addFields(
            { name: '🐟 Cá Đã Câu', value: `${userStats.catches}`, inline: true },
            { name: '💎 Tổng Giá Trị', value: formatCurrency(userStats.totalValue), inline: true },
            { name: '⭐ Vật Phẩm Đặc Biệt', value: `${userStats.specialCatches.length}`, inline: true }
        );
    } else {
        embed.addFields({ name: '📝 Trạng Thái', value: 'Chưa tham gia - dùng `/sukiencauca thamgia` để tham gia!', inline: false });
    }
    
    await interaction.reply({ embeds: [embed] });
}

async function handleLeaderboard(interaction) {
    if (!currentEvent) {
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('🎣 Không Có Sự Kiện')
            .setDescription('Hiện tại không có sự kiện câu cá nào đang diễn ra. Sự kiện sẽ bắt đầu ngẫu nhiên trong ngày!')
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
    }
    
    const leaderboard = Array.from(eventParticipants.entries())
        .sort(([,a], [,b]) => b.totalValue - a.totalValue)
        .slice(0, 10);
    
    const embed = new EmbedBuilder()
        .setColor('#ffd700')
        .setTitle(`🏆 ${currentEvent.name} - Bảng Xếp Hạng`)
        .setTimestamp();
    
    if (leaderboard.length === 0) {
        embed.setDescription('Chưa có ai tham gia! Hãy là người đầu tiên với `/sukiencauca thamgia`');
    } else {
        const description = leaderboard.map(([userId, stats], index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            return `${medal} <@${userId}> - ${formatCurrency(stats.totalValue)} (${stats.catches} con cá)`;
        }).join('\n');
        
        embed.setDescription(description);
    }
    
    await interaction.reply({ embeds: [embed] });
}

// Start a random fishing event
export function startRandomEvent() {
    if (currentEvent) return; // Event already active
    
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    
    currentEvent = {
        ...eventType,
        startTime: Date.now(),
        endTime: Date.now() + eventType.duration
    };
    
    eventParticipants.clear();
    
    // Auto-end event when time expires
    setTimeout(() => {
        endCurrentEvent();
    }, eventType.duration);
    
    console.log(`🎣 Sự kiện câu cá bắt đầu: ${currentEvent.name}`);
}

// End the current event and distribute rewards
async function endCurrentEvent() {
    if (!currentEvent) return;
    
    // Process rewards for all participants - will import database when bot runs
    try {
        const { getUser, updateUser } = await import('../database.mjs');
        for (const [userId, stats] of eventParticipants.entries()) {
            try {
                const user = await getUser(userId, stats.guildId);
                if (user) {
                    // Add bonus coins based on participation
                    const bonusCoins = Math.floor(stats.totalValue * 0.1); // 10% bonus
                    user.coins += bonusCoins;
                    await updateUser(user);
                }
            } catch (error) {
                console.error(`Lỗi xử lý phần thưởng sự kiện cho user ${userId}:`, error);
            }
        }
    } catch (error) {
        console.error('Database module not available:', error);
    }
    
    console.log(`🎣 Sự kiện câu cá kết thúc: ${currentEvent.name} với ${eventParticipants.size} người tham gia`);
    
    currentEvent = null;
    eventParticipants.clear();
}

// Helper function to check if user is in event and apply bonuses
export function applyEventBonus(userId, fishValue, fishName) {
    // Ensure fishValue is a valid number
    const baseValue = Number(fishValue) || 100;
    
    if (!currentEvent || !eventParticipants.has(userId)) {
        return { value: baseValue, isEventCatch: false };
    }
    
    const participant = eventParticipants.get(userId);
    participant.catches++;
    
    let bonusValue = baseValue * currentEvent.multiplier;
    let specialItem = null;
    
    // Check for special event bonuses
    if (currentEvent.rareChance && Math.random() < currentEvent.rareChance) {
        bonusValue *= 2;
        specialItem = "Cá Vàng " + fishName;
        participant.specialCatches.push(specialItem);
    }
    
    if (currentEvent.treasureChance && Math.random() < currentEvent.treasureChance) {
        const treasures = ["Đồng Xu Cổ", "Vòng Cổ Ngọc Trai", "Kho Báu Chìm", "Chai Bí Ẩn"];
        specialItem = treasures[Math.floor(Math.random() * treasures.length)];
        bonusValue += 500 + Math.random() * 1000;
        participant.specialCatches.push(specialItem);
    }
    
    participant.totalValue += bonusValue;
    
    return { 
        value: Math.floor(bonusValue), 
        isEventCatch: true, 
        specialItem,
        eventName: currentEvent.name 
    };
}

// Auto-start events randomly (call this from main bot file)
export function initEventScheduler() {
    // Start event every 2-4 hours randomly
    const scheduleNextEvent = () => {
        const delay = (2 + Math.random() * 2) * 60 * 60 * 1000; // 2-4 hours
        setTimeout(() => {
            startRandomEvent();
            scheduleNextEvent(); // Schedule next event
        }, delay);
    };
    
    scheduleNextEvent();
    console.log('🎣 Bộ lập lịch sự kiện câu cá đã khởi tạo');
}

function formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes} phút ${seconds} giây`;
}

export { currentEvent, eventParticipants };