import mongoose from 'mongoose';

const taiXiuGameSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    unique: true
  },
  round: {
    type: Number,
    default: 1
  },
  isActive: {
    type: Boolean,
    default: false
  },
  bettingPhase: {
    type: Boolean,
    default: true
  },
  timeLeft: {
    type: Number,
    default: 30
  },
  bettingTime: {
    type: Number,
    default: 30
  },
  resultTime: {
    type: Number,
    default: 10
  },
  totalBets: {
    tai: { type: Number, default: 0 },
    xiu: { type: Number, default: 0 }
  },
  playerCount: {
    tai: { type: Number, default: 0 },
    xiu: { type: Number, default: 0 }
  },
  history: [{
    round: Number,
    dice: [Number],
    total: Number,
    result: String,
    timestamp: { type: Date, default: Date.now }
  }],
  lastResult: {
    dice: [Number],
    total: Number,
    result: String
  },
  channelId: String,
  messageId: String,
  autoRestart: {
    type: Boolean,
    default: true
  },
  pausedAt: Date,
  resumedAt: Date
}, {
  timestamps: true
});

// Index for faster queries
taiXiuGameSchema.index({ guildId: 1 });

export default mongoose.model('TaiXiuGame', taiXiuGameSchema);
