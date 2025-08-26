import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  username: String,
  // Global currency - shared across all servers
  coins: {
    type: Number,
    default: 1000
  },
  // Global fishing rod
  fishingRod: {
    name: {
      type: String,
      default: 'Cần Câu Cơ Bản'
    },
    durability: {
      type: Number,
      default: 100
    },
    maxDurability: {
      type: Number,
      default: 100
    },
    effectiveness: {
      type: Number,
      default: 100
    }
  },
  // Global inventory
  inventory: {
    type: Map,
    of: Number,
    default: new Map()
  },
  // Global stats
  totalFishCaught: {
    type: Number,
    default: 0
  },
  rareFishCaught: {
    type: Number,
    default: 0
  },
  totalCasts: {
    type: Number,
    default: 0
  },
  successfulCasts: {
    type: Number,
    default: 0
  },
  // Guild-specific data (for things that should remain per-server)
  guildData: [{
    guildId: String,
    experience: {
      type: Number,
      default: 0
    },
    level: {
      type: Number,
      default: 1
    },
    lastDaily: Date,
    lastFish: Date,
    // Server-specific achievements, relationships, etc.
    achievements: [String],
    relationshipStatus: {
      type: String,
      enum: ['single', 'dating', 'married'],
      default: 'single'
    },
    partner: String,
    relationshipStartDate: Date
  }],
  // Global settings
  settings: {
    theme: {
      type: String,
      default: 'default'
    },
    notifications: {
      type: Boolean,
      default: true
    },
    language: {
      type: String,
      default: 'vi'
    }
  },
  // Premium features (global)
  premium: {
    isActive: {
      type: Boolean,
      default: false
    },
    expiresAt: Date,
    benefits: {
      dailyMultiplier: {
        type: Number,
        default: 1
      },
      fishingBonus: {
        type: Number,
        default: 1
      },
      xpBonus: {
        type: Number,
        default: 1
      }
    }
  }
}, {
  timestamps: true
});

// Compound index for efficient guild-specific queries
userSchema.index({ userId: 1, 'guildData.guildId': 1 });

// Helper method to get guild-specific data
userSchema.methods.getGuildData = function(guildId) {
  return this.guildData.find(data => data.guildId === guildId) || null;
};

// Helper method to update guild-specific data
userSchema.methods.updateGuildData = function(guildId, updateData) {
  const existingData = this.guildData.find(data => data.guildId === guildId);
  
  if (existingData) {
    Object.assign(existingData, updateData);
  } else {
    this.guildData.push({
      guildId,
      ...updateData
    });
  }
};

export default mongoose.model('GlobalUser', userSchema);