import mongoose from 'mongoose';

const giftcodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  guildId: { type: String, required: true, index: true },
  createdBy: { type: String, required: true }, // Discord user ID
  
  // Rewards
  rewards: {
    coins: { type: Number, default: 0 },
    bait: { type: Number, default: 0 },
    items: { type: Map, of: Number, default: {} }, // itemName: quantity
    freeFishingTries: { type: Number, default: 0 }
  },
  
  // Usage limits
  maxUses: { type: Number, default: 1 }, // -1 for unlimited
  currentUses: { type: Number, default: 0 },
  usedBy: [{ type: String }], // Array of user IDs who used this code
  
  // Expiration
  expiresAt: { type: Date, default: null },
  
  // Settings
  isActive: { type: Boolean, default: true },
  oneTimePerUser: { type: Boolean, default: true },
  
  // Metadata
  description: { type: String, default: '' },
  category: { type: String, default: 'general' } // 'general', 'event', 'admin', 'premium'
}, { timestamps: true });

giftcodeSchema.index({ code: 1, guildId: 1 }, { unique: true });
giftcodeSchema.index({ expiresAt: 1 });
giftcodeSchema.index({ isActive: 1 });

export default mongoose.model('Giftcode', giftcodeSchema);