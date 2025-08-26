import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import GlobalUser from '../models/GlobalUser.mjs';
import { formatCurrency } from './util.mjs';
import { getMaxDurability } from '../game/durability.mjs';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('Xem thông tin profile của bạn hoặc người khác')
  .addUserOption(option => option.setName('user').setDescription('Người dùng muốn xem profile').setRequired(false));

export async function execute(interaction) {
  try {
    await interaction.deferReply();
    
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const userId = targetUser.id;
    const guildId = interaction.guildId;
    
    // Find global user
    let globalUser = await GlobalUser.findOne({ userId });
    
    if (!globalUser) {
      if (targetUser.id === interaction.user.id) {
        // Create new global user for self
        globalUser = new GlobalUser({ 
          userId,
          username: targetUser.username 
        });
        await globalUser.save();
      } else {
        return interaction.editReply({
          content: '❌ Người dùng này chưa có tài khoản!'
        });
      }
    }

    // Get guild-specific data
    const guildData = globalUser.getGuildData(guildId) || {
      experience: 0,
      level: 1,
      relationshipStatus: 'single'
    };

    const embed = new EmbedBuilder()
      .setColor('#48dbfb')
      .setTitle(`👤 Profile - ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .setTimestamp();

    // Add global user data
    embed.addFields([
      {
        name: '💰 Tài Chính (Global)',
        value: `💎 **Xu:** ${formatCurrency(globalUser.coins)}\n🌍 **Dùng chung tất cả server**`,
        inline: true
      },
      {
        name: '📊 Level (Server này)',
        value: `⭐ **Level:** ${guildData.level}\n✨ **Kinh nghiệm:** ${guildData.experience}`,
        inline: true
      },
      {
        name: '🎣 Thống Kê Câu Cá (Global)',
        value: `🐟 **Tổng cá:** ${globalUser.totalFishCaught || 0}\n🏆 **Cá hiếm:** ${globalUser.rareFishCaught || 0}\n📈 **Tỷ lệ thành công:** ${((globalUser.successfulCasts || 0) / Math.max(globalUser.totalCasts || 1, 1) * 100).toFixed(1)}%`,
        inline: false
      }
    ]);

    // Add fishing rod info
    if (globalUser.fishingRod) {
      const rod = globalUser.fishingRod;
      const durabilityPercent = (rod.durability / rod.maxDurability) * 100;
      let durabilityIcon = '🟢';
      
      if (durabilityPercent < 80) durabilityIcon = '🟡';
      if (durabilityPercent < 60) durabilityIcon = '🟠';
      if (durabilityPercent < 40) durabilityIcon = '🔴';
      if (durabilityPercent < 20) durabilityIcon = '💀';

      embed.addFields([
        {
          name: '🎣 Cần Câu (Global)',
          value: `${durabilityIcon} **${rod.name}**\n🔧 Độ bền: ${rod.durability}/${rod.maxDurability} (${durabilityPercent.toFixed(1)}%)\n📈 Hiệu quả: ${rod.effectiveness}%`,
          inline: true
        }
      ]);
    }

    // Add relationship info (server-specific)
    if (guildData.relationshipStatus !== 'single') {
      let relationshipText = `💝 **Trạng thái:** ${guildData.relationshipStatus === 'dating' ? 'Đang hẹn hò' : 'Đã kết hôn'}`;
      
      if (guildData.partner) {
        try {
          const partnerUser = await interaction.client.users.fetch(guildData.partner);
          relationshipText += `\n💕 **Đối tác:** ${partnerUser.username}`;
        } catch {
          relationshipText += `\n� **Đối tác:** Không tìm thấy`;
        }
      }
      
      if (guildData.relationshipStartDate) {
        const days = Math.floor((Date.now() - guildData.relationshipStartDate.getTime()) / (1000 * 60 * 60 * 24));
        relationshipText += `\n� **Thời gian:** ${days} ngày`;
      }

      embed.addFields([
        {
          name: '� Mối Quan Hệ (Server này)',
          value: relationshipText,
          inline: true
        }
      ]);
    }

    // Add premium info if active
    if (globalUser.premium?.isActive) {
      embed.addFields([
        {
          name: '⭐ Premium (Global)',
          value: `✨ **Đang kích hoạt**\n📅 **Hết hạn:** <t:${Math.floor(globalUser.premium.expiresAt.getTime() / 1000)}:R>`,
          inline: false
        }
      ]);
    }

    embed.setFooter({
      text: '� Xu và vật phẩm được chia sẻ trên tất cả server!'
    });

    return interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Profile command error:', error);
    return interaction.editReply({
      content: '❌ Có lỗi xảy ra khi lấy thông tin hồ sơ!'
    });
  }
}
