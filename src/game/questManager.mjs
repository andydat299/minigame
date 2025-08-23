import Quest from '../models/Quest.mjs';
import UserQuest from '../models/UserQuest.mjs';
import User from '../models/User.mjs';

// Default quests that get created on startup
export const DEFAULT_QUESTS = [
    // Daily Quests
    {
        questId: 'daily_fish_5',
        name: '🎣 Thợ Câu Hàng Ngày',
        description: 'Câu 5 con cá trong ngày',
        type: 'daily',
        category: 'fishing',
        requirements: { fishCatch: 5 },
        rewards: { coins: 1000, exp: 50 },
        difficulty: 'easy'
    },
    {
        questId: 'daily_spend_100',
        name: '� Chi Tiêu Hàng Ngày',
        description: 'Chi 100 xu cho hoạt động câu cá',
        type: 'daily',
        category: 'economy',
        requirements: { coinsSpend: 100 },
        rewards: { coins: 200, exp: 25 },
        difficulty: 'easy'
    },
    {
        questId: 'daily_gamble_win',
        name: '🎲 Thắng Casino',
        description: 'Thắng 1 ván casino bất kỳ',
        type: 'daily',
        category: 'gambling',
        requirements: { gamblingWins: 1 },
        rewards: { coins: 2000, exp: 100 },
        difficulty: 'medium'
    },

    // Weekly Quests
    {
        questId: 'weekly_fish_50',
        name: '🐟 Thách Thức Tuần',
        description: 'Câu 50 con cá trong tuần',
        type: 'weekly',
        category: 'fishing',
        requirements: { fishCatch: 50 },
        rewards: { coins: 10000, exp: 500, items: [{ name: 'Rương bạc', count: 1 }] },
        difficulty: 'hard'
    },
    {
        questId: 'weekly_daily_streak',
        name: '📅 Kiên Trì Bền Bỉ',
        description: 'Có streak daily 7 ngày',
        type: 'weekly',
        category: 'general',
        requirements: { dailyStreak: 7 },
        rewards: { coins: 15000, exp: 750, title: 'Người Kiên Trì' },
        difficulty: 'hard'
    },

    // Story Quests
    {
        questId: 'story_first_steps',
        name: '👶 Bước Đầu Tiên',
        description: 'Hoàn thành nhiệm vụ đầu tiên của bạn',
        type: 'story',
        category: 'general',
        requirements: { fishCatch: 1 },
        rewards: { coins: 500, exp: 100, items: [{ name: 'Mồi câu', count: 5 }] },
        difficulty: 'easy'
    },
    {
        questId: 'story_upgrade_master',
        name: '🔧 Thành Thạo Nâng Cấp',
        description: 'Nâng cấp cần câu lên level 3',
        type: 'story',
        category: 'fishing',
        requirements: { rodUpgrade: 3 },
        rewards: { coins: 5000, exp: 300, title: 'Thợ Máy Tập Sự' },
        difficulty: 'medium',
        prerequisiteQuests: ['story_first_steps']
    },

    // Achievement Quests
    {
        questId: 'achievement_collector',
        name: '🏆 Người Sưu Tập',
        description: 'Mở khóa 5 thành tựu',
        type: 'achievement',
        category: 'general',
        requirements: { achievementsUnlock: 5 },
        rewards: { coins: 20000, exp: 1000, title: 'Collector' },
        difficulty: 'legendary'
    }
];

// Initialize default quests
export async function initializeQuests() {
    for (const questData of DEFAULT_QUESTS) {
        try {
            await Quest.updateOne(
                { questId: questData.questId },
                { $setOnInsert: questData },
                { upsert: true }
            );
        } catch (error) {
            console.error(`Error initializing quest ${questData.questId}:`, error);
        }
    }
    console.log('🎯 Quest system initialized');
}

// Get available quests for user
export async function getAvailableQuests(userId, guildId, type = null) {
    const user = await User.findOne({ userId, guildId });
    const userLevel = user?.level || 1;
    
    // Get user's active and completed quests
    const userQuests = await UserQuest.find({ userId, guildId });
    const activeQuestIds = userQuests.filter(uq => uq.status === 'active').map(uq => uq.questId);
    const completedQuestIds = userQuests.filter(uq => uq.status === 'completed').map(uq => uq.questId);
    
    // Build query
    let query = {
        active: true,
        level: { $lte: userLevel },
        questId: { $nin: [...activeQuestIds, ...completedQuestIds] }
    };
    
    if (type) query.type = type;
    
    // Check for non-repeatable completed quests
    const nonRepeatableCompleted = await Quest.find({
        questId: { $in: completedQuestIds },
        repeatable: false
    }).select('questId');
    
    if (nonRepeatableCompleted.length > 0) {
        query.questId.$nin.push(...nonRepeatableCompleted.map(q => q.questId));
    }
    
    const availableQuests = await Quest.find(query);
    
    // Filter by prerequisites
    const validQuests = [];
    for (const quest of availableQuests) {
        if (quest.prerequisiteQuests && quest.prerequisiteQuests.length > 0) {
            const hasPrereqs = quest.prerequisiteQuests.every(prereqId => 
                completedQuestIds.includes(prereqId)
            );
            if (hasPrereqs) validQuests.push(quest);
        } else {
            validQuests.push(quest);
        }
    }
    
    return validQuests;
}

// Accept a quest
export async function acceptQuest(userId, guildId, questId) {
    const quest = await Quest.findOne({ questId, active: true });
    if (!quest) return { success: false, message: 'Quest không tồn tại hoặc không khả dụng' };
    
    const user = await User.findOne({ userId, guildId });
    if (!user || (user.level || 1) < quest.level) {
        return { success: false, message: `Cần level ${quest.level} để nhận quest này` };
    }
    
    // Check if already active
    const existingQuest = await UserQuest.findOne({ userId, guildId, questId, status: 'active' });
    if (existingQuest) return { success: false, message: 'Bạn đã nhận quest này rồi' };
    
    // Check prerequisites
    if (quest.prerequisiteQuests && quest.prerequisiteQuests.length > 0) {
        const completedQuests = await UserQuest.find({
            userId, guildId,
            questId: { $in: quest.prerequisiteQuests },
            status: 'completed'
        });
        
        if (completedQuests.length < quest.prerequisiteQuests.length) {
            return { success: false, message: 'Chưa hoàn thành quest điều kiện' };
        }
    }
    
    // Create user quest
    const expiresAt = quest.timeLimit ? new Date(Date.now() + quest.timeLimit * 60 * 60 * 1000) : null;
    
    await UserQuest.create({
        userId,
        guildId,
        questId,
        expiresAt
    });
    
    return { success: true, quest };
}

// Update quest progress
export async function updateQuestProgress(userId, guildId, progressType, amount = 1, itemName = null) {
    const activeQuests = await UserQuest.find({ userId, guildId, status: 'active' });
    const completedQuests = [];
    
    for (const userQuest of activeQuests) {
        const quest = await Quest.findOne({ questId: userQuest.questId });
        if (!quest) continue;
        
        let updated = false;
        
        // Update progress based on type
        switch (progressType) {
            case 'fishCatch':
                if (quest.requirements.fishCatch > 0) {
                    userQuest.progress.fishCatch += amount;
                    updated = true;
                }
                break;
                
            case 'coinsEarn':
                if (quest.requirements.coinsEarn > 0) {
                    userQuest.progress.coinsEarn += amount;
                    updated = true;
                }
                break;
                
            case 'coinsSpend':
                if (quest.requirements.coinsSpend > 0) {
                    userQuest.progress.coinsSpend += amount;
                    updated = true;
                }
                break;
                
            case 'gamblingWins':
                if (quest.requirements.gamblingWins > 0) {
                    userQuest.progress.gamblingWins += amount;
                    updated = true;
                }
                break;
                
            case 'achievementsUnlock':
                if (quest.requirements.achievementsUnlock > 0) {
                    userQuest.progress.achievementsUnlock += amount;
                    updated = true;
                }
                break;
                
            case 'rodUpgrade':
                if (quest.requirements.rodUpgrade > 0) {
                    userQuest.progress.rodUpgrade = amount; // Set to current level
                    updated = true;
                }
                break;
                
            case 'itemCollect':
                if (quest.requirements.itemsCollect && itemName) {
                    const reqItem = quest.requirements.itemsCollect.find(item => item.name === itemName);
                    if (reqItem) {
                        let progItem = userQuest.progress.itemsCollect.find(item => item.name === itemName);
                        if (!progItem) {
                            progItem = { name: itemName, count: 0 };
                            userQuest.progress.itemsCollect.push(progItem);
                        }
                        progItem.count += amount;
                        updated = true;
                    }
                }
                break;
        }
        
        if (updated) {
            // Check if quest is completed
            if (isQuestCompleted(quest, userQuest)) {
                userQuest.status = 'completed';
                userQuest.completedAt = new Date();
                completedQuests.push({ quest, userQuest });
            }
            
            await userQuest.save();
        }
    }
    
    return completedQuests;
}

// Check if quest is completed
function isQuestCompleted(quest, userQuest) {
    const req = quest.requirements;
    const prog = userQuest.progress;
    
    // Check all requirements
    if (req.fishCatch > 0 && prog.fishCatch < req.fishCatch) return false;
    if (req.coinsEarn > 0 && prog.coinsEarn < req.coinsEarn) return false;
    if (req.coinsSpend > 0 && prog.coinsSpend < req.coinsSpend) return false;
    if (req.gamblingWins > 0 && prog.gamblingWins < req.gamblingWins) return false;
    if (req.achievementsUnlock > 0 && prog.achievementsUnlock < req.achievementsUnlock) return false;
    if (req.rodUpgrade > 0 && prog.rodUpgrade < req.rodUpgrade) return false;
    
    // Check item requirements
    if (req.itemsCollect && req.itemsCollect.length > 0) {
        for (const reqItem of req.itemsCollect) {
            const progItem = prog.itemsCollect.find(item => item.name === reqItem.name);
            if (!progItem || progItem.count < reqItem.count) return false;
        }
    }
    
    return true;
}

// Claim quest rewards
export async function claimQuestRewards(userId, guildId, questId) {
    const userQuest = await UserQuest.findOne({ userId, guildId, questId, status: 'completed' });
    if (!userQuest || userQuest.rewardsClaimed) {
        return { success: false, message: 'Quest chưa hoàn thành hoặc đã nhận thưởng' };
    }
    
    const quest = await Quest.findOne({ questId });
    if (!quest) return { success: false, message: 'Quest không tồn tại' };
    
    const user = await User.findOne({ userId, guildId });
    if (!user) return { success: false, message: 'Không tìm thấy user' };
    
    // Give rewards
    const rewards = quest.rewards;
    
    if (rewards.coins) {
        user.coins = (user.coins || 0) + rewards.coins;
    }
    
    if (rewards.exp) {
        user.exp = (user.exp || 0) + rewards.exp;
        
        // Level up check
        const newLevel = calculateLevel(user.exp);
        if (newLevel > (user.level || 1)) {
            user.level = newLevel;
        }
    }
    
    if (rewards.items && rewards.items.length > 0) {
        for (const rewardItem of rewards.items) {
            const item = user.inventory.find(i => i.name === rewardItem.name);
            if (item) item.count += rewardItem.count;
            else user.inventory.push({ name: rewardItem.name, count: rewardItem.count });
        }
    }
    
    if (rewards.title) {
        if (!user.titles.includes(rewards.title)) {
            user.titles.push(rewards.title);
        }
    }
    
    user.questsCompleted = (user.questsCompleted || 0) + 1;
    
    await user.save();
    
    userQuest.rewardsClaimed = true;
    await userQuest.save();
    
    // Auto-unlock chain quest
    if (rewards.unlockQuest) {
        await acceptQuest(userId, guildId, rewards.unlockQuest);
    }
    
    return { success: true, rewards, newLevel: user.level };
}

// Calculate level from exp
function calculateLevel(exp) {
    return Math.floor(Math.sqrt(exp / 100)) + 1;
}

// Get EXP needed for next level
export function getExpForNextLevel(level) {
    return Math.pow(level, 2) * 100;
}

// Reset daily/weekly quests
export async function resetQuests(type) {
    if (type === 'daily') {
        await UserQuest.deleteMany({ questId: { $regex: '^daily_' }, status: { $in: ['active', 'completed'] } });
    } else if (type === 'weekly') {
        await UserQuest.deleteMany({ questId: { $regex: '^weekly_' }, status: { $in: ['active', 'completed'] } });
    }
    console.log(`🔄 ${type} quests reset`);
}