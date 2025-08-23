import Giftcode from '../models/Giftcode.mjs';

// Auto cleanup expired giftcodes
export function initializeGiftcodeCleanup() {
    console.log('🎁 Giftcode cleanup system initialized');
    
    // Run cleanup every hour
    setInterval(async () => {
        try {
            const result = await Giftcode.updateMany(
                { 
                    expiresAt: { $lt: new Date() },
                    isActive: true 
                },
                { isActive: false }
            );
            
            if (result.modifiedCount > 0) {
                console.log(`🧹 Cleaned up ${result.modifiedCount} expired giftcodes`);
            }
        } catch (error) {
            console.error('Error cleaning up giftcodes:', error);
        }
    }, 60 * 60 * 1000); // Every hour
}

// Generate preset giftcodes for events
export async function createEventGiftcodes(guildId, createdBy) {
    const eventCodes = [
        {
            code: 'WELCOME2024',
            rewards: { coins: 5000, bait: 10, freeFishingTries: 5 },
            maxUses: 100,
            description: 'Giftcode chào mừng năm 2024!'
        },
        {
            code: 'FISHINGFUN',
            rewards: { coins: 1000, bait: 5 },
            maxUses: 50,
            description: 'Giftcode vui vẻ câu cá!'
        },
        {
            code: 'DAILYBONUS',
            rewards: { coins: 500, freeFishingTries: 2 },
            maxUses: -1,
            description: 'Bonus hàng ngày!'
        }
    ];
    
    for (const codeData of eventCodes) {
        try {
            const existing = await Giftcode.findOne({ 
                code: codeData.code, 
                guildId 
            });
            
            if (!existing) {
                await Giftcode.create({
                    ...codeData,
                    guildId,
                    createdBy,
                    category: 'event'
                });
                console.log(`✅ Created event giftcode: ${codeData.code}`);
            }
        } catch (error) {
            console.error(`Error creating event giftcode ${codeData.code}:`, error);
        }
    }
}