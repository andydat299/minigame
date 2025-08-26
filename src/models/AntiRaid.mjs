import mongoose from 'mongoose';

const antiRaidSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true
  },
  isEnabled: {
    type: Boolean,
    default: false
  },
  settings: {
    maxJoinsPerMinute: {
      type: Number,
      default: 5
    },
    maxMessagesPerMinute: {
      type: Number,
      default: 10
    },
    maxMentionsPerMessage: {
      type: Number,
      default: 5
    },
    lockdownDuration: {
      type: Number,
      default: 300 // 5 minutes in seconds
    },
    autoKickSuspicious: {
      type: Boolean,
      default: true
    },
    autoBanRaiders: {
      type: Boolean,
      default: false
    },
    deleteSpamMessages: {
      type: Boolean,
      default: true
    },
    alertChannel: {
      type: String,
      default: null
    },
    whitelistedRoles: [{
      type: String
    }],
    whitelistedUsers: [{
      type: String
    }],
    trustedDomains: [{
      type: String,
      default: ['discord.gg', 'youtube.com', 'twitch.tv']
    }]
  },
  logs: [{
    type: {
      type: String,
      enum: ['join_spam', 'message_spam', 'mention_spam', 'link_spam', 'lockdown', 'kick', 'ban']
    },
    userId: String,
    username: String,
    reason: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    data: mongoose.Schema.Types.Mixed
  }],
  statistics: {
    totalRaidsDetected: {
      type: Number,
      default: 0
    },
    totalUsersKicked: {
      type: Number,
      default: 0
    },
    totalUsersBanned: {
      type: Number,
      default: 0
    },
    totalMessagesDeleted: {
      type: Number,
      default: 0
    },
    lastRaidAt: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
antiRaidSchema.index({ guildId: 1, 'logs.timestamp': -1 });

export default mongoose.model('AntiRaid', antiRaidSchema);