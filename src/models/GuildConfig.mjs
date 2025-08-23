import mongoose from 'mongoose';
const guildConfigSchema = new mongoose.Schema({
  guildId: { type: String, unique: true, required: true },
  bossHours: { type: [Number], default: [] }, // 0..23 giờ VN
  bossDurationMin: { type: Number, default: 15 },
  bossDropValue: { type: Number, default: 600 },
  bossActiveUntil: { type: Date, default: null },
}, { timestamps: true });
export default mongoose.model('GuildConfig', guildConfigSchema);
