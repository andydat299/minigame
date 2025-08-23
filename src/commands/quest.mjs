import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import User from '../models/User.mjs';
import UserQuest from '../models/UserQuest.mjs';
import Quest from '../models/Quest.mjs';
import { formatCurrency } from './util.mjs';
import { 
    getAvailableQuests, 
    acceptQuest, 
    claimQuestRewards, 
    getExpForNextLevel 
} from '../game/questManager.mjs';

export const data = new SlashCommandBuilder()
    .setName('quest')
    .setDescription('Hệ thống nhiệm vụ')
    .addSubcommand(subcommand =>
        subcommand
            .setName('list')
            .setDescription('Xem danh sách nhiệm vụ')
            .addStringOption(option =>
                option.setName('type')
                    .setDescription('Loại nhiệm vụ')
                    .addChoices(
                        { name: 'Tất cả', value: 'all' },
                        { name: 'Hàng ngày', value: 'daily' },
                        { name: 'Hàng tuần', value: 'weekly' },
                        { name: 'Cốt truyện', value: 'story' },
                        { name: 'Thành tựu', value: 'achievement' }
                    )))
    .addSubcommand(subcommand =>
        subcommand
            .setName('active')
            .setDescription('Xem nhiệm vụ đang thực hiện'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('accept')
            .setDescription('Nhận nhiệm vụ')
            .addStringOption(option =>
                option.setName('quest_id')
                    .setDescription('ID của nhiệm vụ')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('claim')
            .setDescription('Nhận thưởng nhiệm vụ')
            .addStringOption(option =>
                option.setName('quest_id')
                    .setDescription('ID của nhiệm vụ')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('abandon')
            .setDescription('Hủy bỏ nhiệm vụ')
            .addStringOption(option =>
                option.setName('quest_id')
                    .setDescription('ID của nhiệm vụ')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('profile')
            .setDescription('Xem thông tin quest profile'));

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
        case 'list':
            await handleList(interaction);
            break;
        case 'active':
            await handleActive(interaction);
            break;
        case 'accept':
            await handleAccept(interaction);
            break;
        case 'claim':
            await handleClaim(interaction);
            break;
        case 'abandon':
            await handleAbandon(interaction);
            break;
        case 'profile':
            await handleProfile(interaction);
            break;
    }
}

async function handleList(interaction) {
    const type = interaction.options.getString('type') || 'all';
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    const questType = type === 'all' ? null : type;
    const availableQuests = await getAvailableQuests(userId, guildId, questType);
    
    const embed = new EmbedBuilder()
        .setColor('#48dbfb')
        .setTitle('🎯 Nhiệm Vụ Khả Dụng')
        .setTimestamp();
    
    if (availableQuests.length === 0) {
        embed.setDescription('Không có nhiệm vụ nào khả dụng.');
        return interaction.reply({ embeds: [embed] });
    }
    
    // Group by type
    const questsByType = {
        daily: [],
        weekly: [],
        story: [],
        achievement: []
    };
    
    availableQuests.forEach(quest => {
        questsByType[quest.type].push(quest);
    });
    
    // Add fields for each type
    const typeEmojis = {
        daily: '📅',
        weekly: '🗓️',
        story: '📚',
        achievement: '🏆'
    };
    
    const typeNames = {
        daily: 'Hàng Ngày',
        weekly: 'Hàng Tuần',
        story: 'Cốt Truyện',
        achievement: 'Thành Tựu'
    };
    
    for (const [questType, quests] of Object.entries(questsByType)) {
        if (quests.length > 0) {
            const questList = quests.slice(0, 5).map(quest => {
                const difficultyEmoji = getDifficultyEmoji(quest.difficulty);
                return `**${quest.questId}** ${difficultyEmoji}\n${quest.name}\n*${quest.description}*\n`;
            }).join('\n');
            
            embed.addFields({
                name: `${typeEmojis[questType]} ${typeNames[questType]}`,
                value: questList,
                inline: false
            });
        }
    }
    
    embed.setFooter({ text: 'Sử dụng /quest accept <quest_id> để nhận nhiệm vụ' });
    
    await interaction.reply({ embeds: [embed] });
}

async function handleActive(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    const activeQuests = await UserQuest.find({ userId, guildId, status: 'active' }).sort({ startedAt: -1 });
    
    const embed = new EmbedBuilder()
        .setColor('#feca57')
        .setTitle('⚡ Nhiệm Vụ Đang Thực Hiện')
        .setTimestamp();
    
    if (activeQuests.length === 0) {
        embed.setDescription('Bạn không có nhiệm vụ nào đang thực hiện.\nSử dụng `/quest list` để xem nhiệm vụ khả dụng.');
        return interaction.reply({ embeds: [embed] });
    }
    
    const questDetails = [];
    
    for (const userQuest of activeQuests) {
        const quest = await Quest.findOne({ questId: userQuest.questId });
        if (!quest) continue;
        
        const progress = getQuestProgressText(quest, userQuest);
        const timeLeft = userQuest.expiresAt ? 
            `⏰ ${Math.ceil((userQuest.expiresAt - Date.now()) / (1000 * 60 * 60))}h` : 
            '⏰ Không giới hạn';
        
        questDetails.push(
            `**${quest.questId}** ${getDifficultyEmoji(quest.difficulty)}\n` +
            `${quest.name}\n` +
            `${progress}\n` +
            `${timeLeft}\n`
        );
    }
    
    embed.setDescription(questDetails.join('\n'));
    embed.setFooter({ text: 'Sử dụng /quest claim <quest_id> để nhận thưởng khi hoàn thành' });
    
    await interaction.reply({ embeds: [embed] });
}

async function handleAccept(interaction) {
    const questId = interaction.options.getString('quest_id');
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    const result = await acceptQuest(userId, guildId, questId);
    
    if (!result.success) {
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('❌ Không Thể Nhận Nhiệm Vụ')
            .setDescription(result.message)
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    const quest = result.quest;
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Đã Nhận Nhiệm Vụ')
        .setDescription(`Bạn đã nhận nhiệm vụ: **${quest.name}**`)
        .addFields(
            { name: '📝 Mô Tả', value: quest.description, inline: false },
            { name: '🎯 Yêu Cầu', value: getRequirementsText(quest), inline: false },
            { name: '🎁 Phần Thưởng', value: getRewardsText(quest), inline: false }
        )
        .setTimestamp();
    
    if (quest.timeLimit) {
        embed.addFields({ name: '⏰ Thời Hạn', value: `${quest.timeLimit} giờ`, inline: true });
    }
    
    await interaction.reply({ embeds: [embed] });
}

async function handleClaim(interaction) {
    const questId = interaction.options.getString('quest_id');
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    const result = await claimQuestRewards(userId, guildId, questId);
    
    if (!result.success) {
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('❌ Không Thể Nhận Thưởng')
            .setDescription(result.message)
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    const rewards = result.rewards;
    const embed = new EmbedBuilder()
        .setColor('#ffd700')
        .setTitle('🎉 Đã Hoàn Thành Nhiệm Vụ!')
        .setDescription('Chúc mừng! Bạn đã nhận được phần thưởng:')
        .setTimestamp();
    
    const rewardText = [];
    if (rewards.coins) rewardText.push(`💰 ${formatCurrency(rewards.coins)}`);
    if (rewards.exp) rewardText.push(`⭐ ${rewards.exp} EXP`);
    if (rewards.items && rewards.items.length > 0) {
        rewards.items.forEach(item => rewardText.push(`📦 ${item.name} x${item.count}`));
    }
    if (rewards.title) rewardText.push(`🏷️ Title: ${rewards.title}`);
    
    embed.addFields({ name: '🎁 Phần Thưởng', value: rewardText.join('\n'), inline: false });
    
    if (result.newLevel > 1) {
        embed.addFields({ name: '🆙 Level Up!', value: `Bạn đã lên level ${result.newLevel}!`, inline: false });
    }
    
    await interaction.reply({ embeds: [embed] });
}

async function handleAbandon(interaction) {
    const questId = interaction.options.getString('quest_id');
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    const userQuest = await UserQuest.findOne({ userId, guildId, questId, status: 'active' });
    if (!userQuest) {
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('❌ Không Tìm Thấy')
            .setDescription('Không tìm thấy nhiệm vụ đang thực hiện với ID này.')
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    userQuest.status = 'abandoned';
    await userQuest.save();
    
    const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('🗑️ Đã Hủy Nhiệm Vụ')
        .setDescription(`Đã hủy nhiệm vụ: **${questId}**`)
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

async function handleProfile(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    let user = await User.findOne({ userId, guildId });
    if (!user) user = await User.create({ userId, guildId });
    
    const level = user.level || 1;
    const currentExp = user.exp || 0;
    const expForNext = getExpForNextLevel(level);
    const expNeeded = expForNext - currentExp;
    const questsCompleted = user.questsCompleted || 0;
    
    const activeCount = await UserQuest.countDocuments({ userId, guildId, status: 'active' });
    const completedCount = await UserQuest.countDocuments({ userId, guildId, status: 'completed' });
    
    const embed = new EmbedBuilder()
        .setColor('#48dbfb')
        .setTitle(`🎯 Quest Profile - ${interaction.user.username}`)
        .addFields(
            { name: '⭐ Level', value: `${level}`, inline: true },
            { name: '🔮 EXP', value: `${currentExp.toLocaleString()}/${expForNext.toLocaleString()}`, inline: true },
            { name: '📈 EXP Cần', value: `${expNeeded.toLocaleString()}`, inline: true },
            { name: '🎯 Đang Làm', value: `${activeCount}`, inline: true },
            { name: '✅ Đã Hoàn Thành', value: `${completedCount}`, inline: true },
            { name: '🏆 Tổng Quest', value: `${questsCompleted}`, inline: true }
        )
        .setTimestamp();
    
    if (user.activeTitle) {
        embed.addFields({ name: '🏷️ Title Hiện Tại', value: user.activeTitle, inline: false });
    }
    
    if (user.titles && user.titles.length > 0) {
        embed.addFields({ name: '🎖️ Titles Sở Hữu', value: user.titles.join(', '), inline: false });
    }
    
    await interaction.reply({ embeds: [embed] });
}

// Helper functions
function getDifficultyEmoji(difficulty) {
    const emojis = {
        easy: '🟢',
        medium: '🟡',
        hard: '🔴',
        legendary: '🟣'
    };
    return emojis[difficulty] || '⚪';
}

function getRequirementsText(quest) {
    const req = quest.requirements;
    const requirements = [];
    
    if (req.fishCatch > 0) requirements.push(`🎣 Câu ${req.fishCatch} con cá`);
    if (req.coinsEarn > 0) requirements.push(`💰 Kiếm ${formatCurrency(req.coinsEarn)}`);
    if (req.coinsSpend > 0) requirements.push(`💸 Chi ${formatCurrency(req.coinsSpend)}`);
    if (req.gamblingWins > 0) requirements.push(`🎲 Thắng ${req.gamblingWins} ván casino`);
    if (req.achievementsUnlock > 0) requirements.push(`🏆 Mở khóa ${req.achievementsUnlock} thành tựu`);
    if (req.rodUpgrade > 0) requirements.push(`🔧 Nâng cấp cần câu lên level ${req.rodUpgrade}`);
    if (req.itemsCollect && req.itemsCollect.length > 0) {
        req.itemsCollect.forEach(item => {
            requirements.push(`📦 Thu thập ${item.name} x${item.count}`);
        });
    }
    
    return requirements.join('\n') || 'Không có yêu cầu đặc biệt';
}

function getRewardsText(quest) {
    const rewards = quest.rewards;
    const rewardText = [];
    
    if (rewards.coins > 0) rewardText.push(`💰 ${formatCurrency(rewards.coins)}`);
    if (rewards.exp > 0) rewardText.push(`⭐ ${rewards.exp} EXP`);
    if (rewards.items && rewards.items.length > 0) {
        rewards.items.forEach(item => {
            rewardText.push(`📦 ${item.name} x${item.count}`);
        });
    }
    if (rewards.title) rewardText.push(`🏷️ Title: ${rewards.title}`);
    
    return rewardText.join('\n') || 'Không có phần thưởng';
}

function getQuestProgressText(quest, userQuest) {
    const req = quest.requirements;
    const prog = userQuest.progress;
    const progressItems = [];
    
    if (req.fishCatch > 0) {
        const current = Math.min(prog.fishCatch, req.fishCatch);
        const emoji = current >= req.fishCatch ? '✅' : '🔄';
        progressItems.push(`${emoji} Câu cá: ${current}/${req.fishCatch}`);
    }
    
    if (req.coinsEarn > 0) {
        const current = Math.min(prog.coinsEarn, req.coinsEarn);
        const emoji = current >= req.coinsEarn ? '✅' : '🔄';
        progressItems.push(`${emoji} Kiếm tiền: ${formatCurrency(current)}/${formatCurrency(req.coinsEarn)}`);
    }
    
    if (req.coinsSpend > 0) {
        const current = Math.min(prog.coinsSpend, req.coinsSpend);
        const emoji = current >= req.coinsSpend ? '✅' : '🔄';
        progressItems.push(`${emoji} Chi tiền: ${formatCurrency(current)}/${formatCurrency(req.coinsSpend)}`);
    }
    
    if (req.gamblingWins > 0) {
        const current = Math.min(prog.gamblingWins, req.gamblingWins);
        const emoji = current >= req.gamblingWins ? '✅' : '🔄';
        progressItems.push(`${emoji} Thắng casino: ${current}/${req.gamblingWins}`);
    }
    
    if (req.achievementsUnlock > 0) {
        const current = Math.min(prog.achievementsUnlock, req.achievementsUnlock);
        const emoji = current >= req.achievementsUnlock ? '✅' : '🔄';
        progressItems.push(`${emoji} Mở khóa thành tựu: ${current}/${req.achievementsUnlock}`);
    }
    
    if (req.rodUpgrade > 0) {
        const current = Math.min(prog.rodUpgrade, req.rodUpgrade);
        const emoji = current >= req.rodUpgrade ? '✅' : '🔄';
        progressItems.push(`${emoji} Nâng cấp cần: Level ${current}/${req.rodUpgrade}`);
    }
    
    if (req.dailyStreak > 0) {
        const current = Math.min(prog.dailyStreak, req.dailyStreak);
        const emoji = current >= req.dailyStreak ? '✅' : '🔄';
        progressItems.push(`${emoji} Daily streak: ${current}/${req.dailyStreak} ngày`);
    }
    
    // Add item collection progress
    if (req.itemsCollect && req.itemsCollect.length > 0) {
        req.itemsCollect.forEach(reqItem => {
            const progItem = prog.itemsCollect?.find(item => item.name === reqItem.name);
            const current = Math.min(progItem?.count || 0, reqItem.count);
            const emoji = current >= reqItem.count ? '✅' : '🔄';
            progressItems.push(`${emoji} ${reqItem.name}: ${current}/${reqItem.count}`);
        });
    }
    
    return progressItems.join('\n') || 'Tiến độ không xác định';
}