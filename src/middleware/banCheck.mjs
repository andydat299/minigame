import { EmbedBuilder } from 'discord.js';
import User from '../models/User.mjs';
import { errorEmbed } from '../commands/util.mjs';

// Middleware to check if user is banned before executing commands
export async function checkBanStatus(interaction) {
    try {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        
        // Find user in database
        const userProfile = await User.findOne({ userId, guildId });
        
        // Check if user is banned
        if (userProfile && userProfile.banned === true) {
            console.log(`🚫 Banned user ${interaction.user.tag} tried to use ${interaction.commandName}`);
            
            await interaction.reply({
                embeds: [errorEmbed(`🚫 **Bạn đã bị cấm sử dụng bot!**\n\n**Lý do:** ${userProfile.banReason || 'Không có lý do'}\n**Thời gian ban:** ${userProfile.bannedAt ? userProfile.bannedAt.toLocaleString('vi-VN') : 'Không rõ'}\n\nLiên hệ admin để được hỗ trợ.`)],
                ephemeral: true
            });
            return true; // User is banned
        }
        
        return false; // User is not banned
    } catch (error) {
        console.error('Error checking ban status:', error);
        return false; // If error, allow user to continue (failsafe)
    }
}