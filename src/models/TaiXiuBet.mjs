import mongoose from 'mongoose';

const taiXiuBetSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  round: {
    type: Number,
    required: true
  },
  choice: {
    type: String,
    enum: ['tai', 'xiu'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  isWon: {
    type: Boolean,
    default: null
  },
  payout: {
    type: Number,
    default: 0
  },
  placedAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound index for faster queries
taiXiuBetSchema.index({ guildId: 1, round: 1 });
taiXiuBetSchema.index({ guildId: 1, userId: 1, round: 1 });
taiXiuBetSchema.index({ guildId: 1, isActive: 1 });

export default mongoose.model('TaiXiuBet', taiXiuBetSchema);
