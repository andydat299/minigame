import mongoose from 'mongoose';

const userQuestSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  questId: { type: String, required: true },
  
  status: { type: String, enum: ['active', 'completed', 'failed', 'abandoned'], default: 'active' },
  progress: {
    fishCatch: { type: Number, default: 0 },
    coinsEarn: { type: Number, default: 0 },
    coinsSpend: { type: Number, default: 0 },
    gamblingWins: { type: Number, default: 0 },
    dailyStreak: { type: Number, default: 0 },
    itemsCollect: [{ name: String, count: Number }],
    commandsUse: [{ command: String, count: Number }],
    achievementsUnlock: { type: Number, default: 0 },
    rodUpgrade: { type: Number, default: 0 }
  },
  
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  expiresAt: { type: Date },
  
  rewardsClaimed: { type: Boolean, default: false }
}, { timestamps: true });

userQuestSchema.index({ userId: 1, guildId: 1, questId: 1 }, { unique: true });

export default mongoose.model('UserQuest', userQuestSchema);