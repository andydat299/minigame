import mongoose from 'mongoose';

const profileThemeSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  
  // Active theme
  activeTheme: { type: String, default: 'default' },
  
  // Owned themes
  ownedThemes: [{ type: String }],
  
  // Theme customizations
  customizations: {
    backgroundColor: { type: String, default: '#48dbfb' },
    accentColor: { type: String, default: '#ff6b6b' },
    textColor: { type: String, default: '#ffffff' },
    borderStyle: { type: String, default: 'solid' },
    profileIcon: { type: String, default: '🎣' },
    backgroundPattern: { type: String, default: 'none' },
    animationStyle: { type: String, default: 'none' }
  },
  
  // Theme effects
  effects: {
    sparkles: { type: Boolean, default: false },
    rainbow: { type: Boolean, default: false },
    glow: { type: Boolean, default: false },
    animated: { type: Boolean, default: false }
  },
  
  // Achievement badges
  badges: [{
    id: { type: String },
    name: { type: String },
    icon: { type: String },
    rarity: { type: String, enum: ['common', 'rare', 'epic', 'legendary'] },
    earnedAt: { type: Date, default: Date.now }
  }],
  
  // Profile showcase
  showcase: {
    favoriteAchievement: { type: String },
    favoriteItem: { type: String },
    mood: { type: String, default: '😊' },
    status: { type: String, default: 'Đang câu cá...' },
    quote: { type: String }
  }
  
}, { timestamps: true });

profileThemeSchema.index({ userId: 1, guildId: 1 }, { unique: true });

export default mongoose.model('ProfileTheme', profileThemeSchema);