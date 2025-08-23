import mongoose from 'mongoose';

const questSchema = new mongoose.Schema({
  questId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  type: { type: String, enum: ['daily', 'weekly', 'story', 'achievement'], default: 'daily' },
  category: { type: String, enum: ['fishing', 'economy', 'gambling', 'social', 'general'], default: 'general' },
  
  // Requirements
  requirements: {
    fishCatch: { type: Number, default: 0 },
    coinsEarn: { type: Number, default: 0 },
    coinsSpend: { type: Number, default: 0 },
    gamblingWins: { type: Number, default: 0 },
    dailyStreak: { type: Number, default: 0 },
    itemsCollect: [{ name: String, count: Number }],
    commandsUse: [{ command: String, count: Number }],
    achievementsUnlock: { type: Number, default: 0 },
    rodUpgrade: { type: Number, default: 0 },
    customCondition: { type: String, default: null } // For special quests
  },
  
  // Rewards
  rewards: {
    coins: { type: Number, default: 0 },
    exp: { type: Number, default: 0 },
    items: [{ name: String, count: Number }],
    title: { type: String, default: null },
    unlockQuest: { type: String, default: null } // Chain quest
  },
  
  // Quest properties
  difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'legendary'], default: 'easy' },
  repeatable: { type: Boolean, default: false },
  timeLimit: { type: Number, default: null }, // Hours
  prerequisiteQuests: [{ type: String }],
  level: { type: Number, default: 1 }, // Player level requirement
  
  active: { type: Boolean, default: true },
  seasonal: { type: Boolean, default: false },
  seasonStart: { type: Date },
  seasonEnd: { type: Date }
}, { timestamps: true });

export default mongoose.model('Quest', questSchema);