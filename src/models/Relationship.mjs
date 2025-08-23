import mongoose from 'mongoose';

const relationshipSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  user1Id: { type: String, required: true },
  user2Id: { type: String, required: true },
  
  // Relationship types
  type: { 
    type: String, 
    enum: ['marriage', 'friendship', 'mentorship', 'rivalry'], 
    required: true 
  },
  
  // Status
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'rejected', 'broken'], 
    default: 'pending' 
  },
  
  // Marriage specific
  marriageDate: { type: Date },
  anniversary: { type: Number, default: 0 }, // years
  
  // Friendship specific
  friendshipLevel: { type: Number, default: 1, min: 1, max: 10 },
  friendshipXP: { type: Number, default: 0 },
  
  // Mentorship specific
  mentorId: { type: String }, // Who is the mentor
  menteeId: { type: String }, // Who is the mentee
  lessonsCompleted: { type: Number, default: 0 },
  
  // Rivalry specific
  rivalryScore: { 
    user1Wins: { type: Number, default: 0 },
    user2Wins: { type: Number, default: 0 },
    draws: { type: Number, default: 0 }
  },
  
  // Shared data
  sharedActivities: { type: Number, default: 0 },
  bonusesEarned: { type: Number, default: 0 },
  lastInteraction: { type: Date, default: Date.now },
  
  // Messages
  proposalMessage: { type: String },
  customNote: { type: String }
  
}, { timestamps: true });

relationshipSchema.index({ guildId: 1, user1Id: 1, user2Id: 1 });
relationshipSchema.index({ guildId: 1, type: 1, status: 1 });

export default mongoose.model('Relationship', relationshipSchema);