import User from '../models/User.mjs';
import { errorEmbed } from '../commands/util.mjs';

export async function checkBanStatus(interaction) {
    try {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        
        const userProfile = await User.findOne({ userId, guildId });
        
        if (userProfile && userProfile.banned === true) {
            console.log(`🚫 Banned user ${interaction.user.tag} tried to use ${interaction.commandName}`);
            
            await interaction.reply({
                embeds: [errorEmbed(`🚫 **Bạn đã bị cấm sử dụng bot!**\n\n**Lý do:** ${userProfile.banReason || 'Không có lý do'}\n**Thời gian ban:** ${userProfile.bannedAt ? userProfile.bannedAt.toLocaleString('vi-VN') : 'Không rõ'}\n\nLiên hệ admin để được hỗ trợ.`)],
                ephemeral: true
            });
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error checking ban status:', error);
        return false;
    }
}