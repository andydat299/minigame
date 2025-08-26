import mongoose from 'mongoose';
import User from '../models/User.mjs';
import GlobalUser from '../models/GlobalUser.mjs';
import dotenv from 'dotenv';

dotenv.config();

async function migrateToGlobalCurrency() {
  try {
    console.log('🔄 Starting migration to global currency system...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to database');

    // Get all users from old model
    const oldUsers = await User.find({});
    console.log(`📊 Found ${oldUsers.length} user records to migrate`);

    const userMap = new Map(); // userId -> combined data

    // Combine data by userId
    for (const oldUser of oldUsers) {
      const userId = oldUser.userId;
      
      if (!userMap.has(userId)) {
        // Create new global user data
        userMap.set(userId, {
          userId,
          username: oldUser.username,
          coins: oldUser.coins || 1000,
          fishingRod: {
            name: oldUser.fishingRod?.name || 'Cần Câu Cơ Bản',
            durability: oldUser.fishingRod?.durability || 100,
            maxDurability: oldUser.fishingRod?.maxDurability || 100,
            effectiveness: oldUser.fishingRod?.effectiveness || 100
          },
          inventory: oldUser.inventory || new Map(),
          totalFishCaught: oldUser.totalFishCaught || 0,
          rareFishCaught: oldUser.rareFishCaught || 0,
          totalCasts: oldUser.totalCasts || 0,
          successfulCasts: oldUser.successfulCasts || 0,
          guildData: []
        });
      }

      const userData = userMap.get(userId);
      
      // Combine coins from all guilds (take the highest amount)
      if (oldUser.coins > userData.coins) {
        userData.coins = oldUser.coins;
      }

      // Combine fishing stats (take the highest)
      userData.totalFishCaught = Math.max(userData.totalFishCaught, oldUser.totalFishCaught || 0);
      userData.rareFishCaught = Math.max(userData.rareFishCaught, oldUser.rareFishCaught || 0);
      userData.totalCasts = Math.max(userData.totalCasts, oldUser.totalCasts || 0);
      userData.successfulCasts = Math.max(userData.successfulCasts, oldUser.successfulCasts || 0);

      // Add guild-specific data
      userData.guildData.push({
        guildId: oldUser.guildId,
        experience: oldUser.experience || 0,
        level: oldUser.level || 1,
        lastDaily: oldUser.lastDaily,
        lastFish: oldUser.lastFish,
        achievements: oldUser.achievements || [],
        relationshipStatus: oldUser.relationshipStatus || 'single',
        partner: oldUser.partner,
        relationshipStartDate: oldUser.relationshipStartDate
      });
    }

    console.log(`🔄 Processed data for ${userMap.size} unique users`);

    // Create new global users
    let migratedCount = 0;
    for (const [userId, userData] of userMap) {
      try {
        // Check if global user already exists
        const existingGlobalUser = await GlobalUser.findOne({ userId });
        
        if (existingGlobalUser) {
          console.log(`⚠️ Global user ${userId} already exists, skipping...`);
          continue;
        }

        // Create new global user
        const globalUser = new GlobalUser(userData);
        await globalUser.save();
        
        migratedCount++;
        
        if (migratedCount % 100 === 0) {
          console.log(`📈 Migrated ${migratedCount} users...`);
        }
      } catch (error) {
        console.error(`❌ Error migrating user ${userId}:`, error.message);
      }
    }

    console.log(`✅ Migration completed! Migrated ${migratedCount} users to global currency system`);
    console.log('⚠️ Note: Old User collection is still intact. You can remove it manually after verification.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateToGlobalCurrency();
}

export { migrateToGlobalCurrency };