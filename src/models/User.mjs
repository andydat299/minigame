import mongoose from 'mongoose';
const fishItemSchema = new mongoose.Schema({ name: String, count: { type: Number, default: 0 } }, { _id: false });
const effectSchema = new mongoose.Schema({ key: String, until: Date }, { _id: false });
const userSchema = new mongoose.Schema({
  userId: { type: String, index: true, required: true },
  guildId: { type: String, index: true, required: true },
  coins: { type: Number, default: 0 },
  // Fishing rod
  rodLevel: { type: Number, default: 1 },
  rodDurability: { type: Number, default: 100 }, // Rod durability (0-100)
  maxDurability: { type: Number, default: 100 }, // Max durability for current rod
  inventory: { type: [fishItemSchema], default: [] },
  bait: { type: Number, default: 0 },
  items: { type: Map, of: Number, default: {} },
  activeEffects: { type: [effectSchema], default: [] },
  totalEarned: { type: Number, default: 0 },
  fishCaught: { type: Number, default: 0 },
  lastFishAt: { type: Date, default: null },
  freeFishingTries: { type: Number, default: 10 }, // 10 lần câu cá miễn phí

  // Daily rewards
  lastDaily: { type: Date, default: null },
  dailyStreak: { type: Number, default: 0 },
  totalDailyClaimed: { type: Number, default: 0 },

  // Gambling stats
  totalGambled: { type: Number, default: 0 },
  totalWon: { type: Number, default: 0 },

    // Achievements
  achievements: [{ id: String, unlockedAt: { type: Date, default: Date.now } }],
  
  // Tài xỉu system
  taixiuStats: {
    totalGames: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    totalBet: { type: Number, default: 0 },
    totalWin: { type: Number, default: 0 },
    biggestWin: { type: Number, default: 0 },
    biggestLoss: { type: Number, default: 0 },
    winStreak: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 }
  },
  
  taixiuAuto: {
    enabled: { type: Boolean, default: false },
    strategy: { type: String, enum: ['martingale', 'pattern', 'fixed', 'random'], default: 'fixed' },
    baseAmount: { type: Number, default: 1000 },
    currentAmount: { type: Number, default: 1000 },
    lastChoice: { type: String, enum: ['tai', 'xiu'] },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    totalProfit: { type: Number, default: 0 }
  },

  // Quest system
  level: { type: Number, default: 1 },
  exp: { type: Number, default: 0 },
  titles: { type: [String], default: [] },
  activeTitle: { type: String, default: null },
  questsCompleted: { type: Number, default: 0 },

  // Ban system fields
  banned: { type: Boolean, default: false },
  bannedAt: { type: Date },
  bannedBy: { type: String }, // Discord user ID of who banned
  banReason: { type: String },
}, { timestamps: true });
userSchema.index({ userId: 1, guildId: 1 }, { unique: true });
export default mongoose.model('UserProfile', userSchema);
