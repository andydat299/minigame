import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import GlobalUser from '../models/GlobalUser.mjs';
import { formatCurrency } from './util.mjs';

export const data = new SlashCommandBuilder()
  .setName('globalbalance')
  .setDescription('Xem số dư xu global (dùng chung tất cả server)')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('Người dùng cần xem (để trống = xem của bạn)')
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();
    
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const userId = targetUser.id;
    
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
        return interaction.editReply('❌ Người dùng này chưa có tài khoản global!');
      }
    }

    const embed = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle('🌍 Số Dư Global')
      .setDescription(`💰 **${targetUser.username}** có **${formatCurrency(globalUser.coins)}** xu`)
      .addFields([
        {
          name: '🌟 Thông Tin',
          value: `• Xu này được sử dụng chung trên **tất cả server**\n• Mọi giao dịch đều ảnh hưởng đến số dư global\n• Server hiện tại: **${interaction.guild.name}**`,
          inline: false
        },
        {
          name: '🎣 Thống Kê Câu Cá Global',
          value: `🐟 **Tổng cá đã câu:** ${globalUser.totalFishCaught || 0}\n🏆 **Cá hiếm:** ${globalUser.rareFishCaught || 0}\n📊 **Tổng lần thả cần:** ${globalUser.totalCasts || 0}`,
          inline: false
        }
      ])
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    // Add fishing rod info
    if (globalUser.fishingRod) {
      const rod = globalUser.fishingRod;
      const durabilityPercent = (rod.durability / rod.maxDurability) * 100;
      let statusIcon = '🟢';
      
      if (durabilityPercent < 80) statusIcon = '🟡';
      if (durabilityPercent < 60) statusIcon = '🟠';
      if (durabilityPercent < 40) statusIcon = '🔴';
      if (durabilityPercent < 20) statusIcon = '💀';

      embed.addFields([
        {
          name: '🎣 Cần Câu Global',
          value: `${statusIcon} **${rod.name}**\n🔧 **Độ bền:** ${rod.durability}/${rod.maxDurability} (${durabilityPercent.toFixed(1)}%)\n📈 **Hiệu quả:** ${rod.effectiveness}%`,
          inline: true
        }
      ]);
    }

    // Show servers this user is active in
    if (globalUser.guildData && globalUser.guildData.length > 0) {
      const serverCount = globalUser.guildData.length;
      embed.addFields([
        {
          name: '🏰 Hoạt động',
          value: `Đang sử dụng trên **${serverCount}** server khác nhau`,
          inline: true
        }
      ]);
    }

    embed.setFooter({
      text: '💡 Sử dụng /migrate để chuyển đổi từ hệ thống cũ sang global'
    });

    return interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Global balance command error:', error);
    return interaction.editReply('❌ Có lỗi xảy ra khi lấy thông tin số dư global!');
  }
}