import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import AntiRaid from '../models/AntiRaid.mjs';
import { formatCurrency } from './util.mjs';

export const data = new SlashCommandBuilder()
  .setName('antiraid')
  .setDescription('Quản lý hệ thống chống raid')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('enable')
      .setDescription('Bật hệ thống chống raid')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('disable')
      .setDescription('Tắt hệ thống chống raid')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('config')
      .setDescription('Cấu hình hệ thống chống raid')
      .addIntegerOption(option =>
        option
          .setName('max_joins')
          .setDescription('Số lượng join tối đa mỗi phút')
          .setMinValue(1)
          .setMaxValue(50)
      )
      .addIntegerOption(option =>
        option
          .setName('max_messages')
          .setDescription('Số tin nhắn tối đa mỗi phút cho 1 user')
          .setMinValue(1)
          .setMaxValue(100)
      )
      .addIntegerOption(option =>
        option
          .setName('max_mentions')
          .setDescription('Số mention tối đa trong 1 tin nhắn')
          .setMinValue(1)
          .setMaxValue(20)
      )
      .addIntegerOption(option =>
        option
          .setName('lockdown_duration')
          .setDescription('Thời gian khóa server (giây)')
          .setMinValue(60)
          .setMaxValue(3600)
      )
      .addChannelOption(option =>
        option
          .setName('alert_channel')
          .setDescription('Kênh nhận thông báo antiraid')
      )
      .addBooleanOption(option =>
        option
          .setName('auto_kick')
          .setDescription('Tự động kick người spam')
      )
      .addBooleanOption(option =>
        option
          .setName('auto_ban')
          .setDescription('Tự động ban người raid')
      )
      .addBooleanOption(option =>
        option
          .setName('delete_spam')
          .setDescription('Tự động xóa tin nhắn spam')
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('whitelist')
      .setDescription('Quản lý whitelist')
      .addStringOption(option =>
        option
          .setName('action')
          .setDescription('Hành động')
          .setRequired(true)
          .addChoices(
            { name: 'Add User', value: 'add_user' },
            { name: 'Remove User', value: 'remove_user' },
            { name: 'Add Role', value: 'add_role' },
            { name: 'Remove Role', value: 'remove_role' },
            { name: 'List', value: 'list' }
          )
      )
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('User để thêm/xóa khỏi whitelist')
      )
      .addRoleOption(option =>
        option
          .setName('role')
          .setDescription('Role để thêm/xóa khỏi whitelist')
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('status')
      .setDescription('Xem trạng thái và thống kê antiraid')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('logs')
      .setDescription('Xem logs antiraid')
      .addIntegerOption(option =>
        option
          .setName('limit')
          .setDescription('Số lượng logs hiển thị')
          .setMinValue(1)
          .setMaxValue(20)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('unlock')
      .setDescription('Mở khóa server thủ công')
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();
    
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // Initialize antiraid if not exists
    let antiRaid = await AntiRaid.findOne({ guildId });
    if (!antiRaid) {
      antiRaid = new AntiRaid({ guildId });
      await antiRaid.save();
    }

    switch (subcommand) {
      case 'enable':
        return await handleEnable(interaction, antiRaid);
      case 'disable':
        return await handleDisable(interaction, antiRaid);
      case 'config':
        return await handleConfig(interaction, antiRaid);
      case 'whitelist':
        return await handleWhitelist(interaction, antiRaid);
      case 'status':
        return await handleStatus(interaction, antiRaid);
      case 'logs':
        return await handleLogs(interaction, antiRaid);
      case 'unlock':
        return await handleUnlock(interaction);
      default:
        return await interaction.editReply('❌ Subcommand không hợp lệ!');
    }

  } catch (error) {
    console.error('AntiRaid command error:', error);
    
    if (interaction.deferred) {
      await interaction.editReply('❌ Có lỗi xảy ra khi thực hiện lệnh!');
    } else {
      await interaction.reply({
        content: '❌ Có lỗi xảy ra khi thực hiện lệnh!',
        ephemeral: true
      });
    }
  }
}

async function handleEnable(interaction, antiRaid) {
  antiRaid.isEnabled = true;
  await antiRaid.save();

  const embed = new EmbedBuilder()
    .setColor('#2ed573')
    .setTitle('✅ AntiRaid Enabled')
    .setDescription('Hệ thống chống raid đã được bật!')
    .addFields([
      {
        name: '🛡️ Bảo vệ hiện tại',
        value: `• Max joins/phút: ${antiRaid.settings.maxJoinsPerMinute}\n• Max messages/phút: ${antiRaid.settings.maxMessagesPerMinute}\n• Max mentions/tin nhắn: ${antiRaid.settings.maxMentionsPerMessage}`,
        inline: false
      }
    ])
    .setTimestamp();

  return await interaction.editReply({ embeds: [embed] });
}

async function handleDisable(interaction, antiRaid) {
  antiRaid.isEnabled = false;
  await antiRaid.save();

  const embed = new EmbedBuilder()
    .setColor('#ff4757')
    .setTitle('❌ AntiRaid Disabled')
    .setDescription('Hệ thống chống raid đã được tắt!')
    .setTimestamp();

  return await interaction.editReply({ embeds: [embed] });
}

async function handleConfig(interaction, antiRaid) {
  const maxJoins = interaction.options.getInteger('max_joins');
  const maxMessages = interaction.options.getInteger('max_messages');
  const maxMentions = interaction.options.getInteger('max_mentions');
  const lockdownDuration = interaction.options.getInteger('lockdown_duration');
  const alertChannel = interaction.options.getChannel('alert_channel');
  const autoKick = interaction.options.getBoolean('auto_kick');
  const autoBan = interaction.options.getBoolean('auto_ban');
  const deleteSpam = interaction.options.getBoolean('delete_spam');

  // Update settings
  if (maxJoins !== null) antiRaid.settings.maxJoinsPerMinute = maxJoins;
  if (maxMessages !== null) antiRaid.settings.maxMessagesPerMinute = maxMessages;
  if (maxMentions !== null) antiRaid.settings.maxMentionsPerMessage = maxMentions;
  if (lockdownDuration !== null) antiRaid.settings.lockdownDuration = lockdownDuration;
  if (alertChannel) antiRaid.settings.alertChannel = alertChannel.id;
  if (autoKick !== null) antiRaid.settings.autoKickSuspicious = autoKick;
  if (autoBan !== null) antiRaid.settings.autoBanRaiders = autoBan;
  if (deleteSpam !== null) antiRaid.settings.deleteSpamMessages = deleteSpam;

  await antiRaid.save();

  const embed = new EmbedBuilder()
    .setColor('#3742fa')
    .setTitle('⚙️ Cấu hình AntiRaid')
    .setDescription('Cài đặt đã được cập nhật!')
    .addFields([
      {
        name: '🔢 Giới hạn',
        value: `• Max joins/phút: ${antiRaid.settings.maxJoinsPerMinute}\n• Max messages/phút: ${antiRaid.settings.maxMessagesPerMinute}\n• Max mentions: ${antiRaid.settings.maxMentionsPerMessage}`,
        inline: true
      },
      {
        name: '⚡ Hành động',
        value: `• Auto kick: ${antiRaid.settings.autoKickSuspicious ? '✅' : '❌'}\n• Auto ban: ${antiRaid.settings.autoBanRaiders ? '✅' : '❌'}\n• Delete spam: ${antiRaid.settings.deleteSpamMessages ? '✅' : '❌'}`,
        inline: true
      },
      {
        name: '⏱️ Lockdown',
        value: `${antiRaid.settings.lockdownDuration} giây`,
        inline: true
      }
    ])
    .setTimestamp();

  if (antiRaid.settings.alertChannel) {
    embed.addFields([
      {
        name: '📢 Alert Channel',
        value: `<#${antiRaid.settings.alertChannel}>`,
        inline: false
      }
    ]);
  }

  return await interaction.editReply({ embeds: [embed] });
}

async function handleStatus(interaction, antiRaid) {
  const embed = new EmbedBuilder()
    .setColor(antiRaid.isEnabled ? '#2ed573' : '#ff4757')
    .setTitle('🛡️ AntiRaid Status')
    .setDescription(`Trạng thái: ${antiRaid.isEnabled ? '🟢 **Enabled**' : '🔴 **Disabled**'}`)
    .addFields([
      {
        name: '📊 Thống kê',
        value: `• Raids đã chặn: ${antiRaid.statistics.totalRaidsDetected}\n• Users kicked: ${antiRaid.statistics.totalUsersKicked}\n• Users banned: ${antiRaid.statistics.totalUsersBanned}\n• Messages xóa: ${antiRaid.statistics.totalMessagesDeleted}`,
        inline: true
      },
      {
        name: '⚙️ Cài đặt',
        value: `• Max joins: ${antiRaid.settings.maxJoinsPerMinute}/phút\n• Max messages: ${antiRaid.settings.maxMessagesPerMinute}/phút\n• Max mentions: ${antiRaid.settings.maxMentionsPerMessage}\n• Lockdown: ${antiRaid.settings.lockdownDuration}s`,
        inline: true
      }
    ])
    .setTimestamp();

  if (antiRaid.statistics.lastRaidAt) {
    embed.addFields([
      {
        name: '🕐 Raid cuối',
        value: `<t:${Math.floor(antiRaid.statistics.lastRaidAt.getTime() / 1000)}:R>`,
        inline: false
      }
    ]);
  }

  return await interaction.editReply({ embeds: [embed] });
}

async function handleLogs(interaction, antiRaid) {
  const limit = interaction.options.getInteger('limit') || 10;
  const logs = antiRaid.logs.slice(-limit).reverse();

  if (!logs.length) {
    return await interaction.editReply('📝 Chưa có logs nào!');
  }

  const embed = new EmbedBuilder()
    .setColor('#747d8c')
    .setTitle('📝 AntiRaid Logs')
    .setTimestamp();

  let description = '';
  logs.forEach((log, index) => {
    const timestamp = `<t:${Math.floor(log.timestamp.getTime() / 1000)}:t>`;
    const user = log.username ? `**${log.username}**` : 'System';
    description += `${index + 1}. ${timestamp} - ${log.type} - ${user}\n`;
  });

  embed.setDescription(description.substring(0, 4000));

  return await interaction.editReply({ embeds: [embed] });
}

async function handleWhitelist(interaction, antiRaid) {
  const action = interaction.options.getString('action');
  const user = interaction.options.getUser('user');
  const role = interaction.options.getRole('role');

  switch (action) {
    case 'add_user':
      if (!user) return await interaction.editReply('❌ Cần chọn user!');
      if (!antiRaid.settings.whitelistedUsers.includes(user.id)) {
        antiRaid.settings.whitelistedUsers.push(user.id);
        await antiRaid.save();
      }
      return await interaction.editReply(`✅ Đã thêm ${user.tag} vào whitelist!`);

    case 'remove_user':
      if (!user) return await interaction.editReply('❌ Cần chọn user!');
      antiRaid.settings.whitelistedUsers = antiRaid.settings.whitelistedUsers.filter(id => id !== user.id);
      await antiRaid.save();
      return await interaction.editReply(`✅ Đã xóa ${user.tag} khỏi whitelist!`);

    case 'add_role':
      if (!role) return await interaction.editReply('❌ Cần chọn role!');
      if (!antiRaid.settings.whitelistedRoles.includes(role.id)) {
        antiRaid.settings.whitelistedRoles.push(role.id);
        await antiRaid.save();
      }
      return await interaction.editReply(`✅ Đã thêm ${role.name} vào whitelist!`);

    case 'remove_role':
      if (!role) return await interaction.editReply('❌ Cần chọn role!');
      antiRaid.settings.whitelistedRoles = antiRaid.settings.whitelistedRoles.filter(id => id !== role.id);
      await antiRaid.save();
      return await interaction.editReply(`✅ Đã xóa ${role.name} khỏi whitelist!`);

    case 'list':
      const embed = new EmbedBuilder()
        .setColor('#5352ed')
        .setTitle('📋 Whitelist')
        .setTimestamp();

      let description = '**👥 Users:**\n';
      if (antiRaid.settings.whitelistedUsers.length) {
        for (const userId of antiRaid.settings.whitelistedUsers) {
          try {
            const user = await interaction.client.users.fetch(userId);
            description += `• ${user.tag}\n`;
          } catch {
            description += `• Unknown User (${userId})\n`;
          }
        }
      } else {
        description += '• Không có\n';
      }

      description += '\n**🎭 Roles:**\n';
      if (antiRaid.settings.whitelistedRoles.length) {
        for (const roleId of antiRaid.settings.whitelistedRoles) {
          const role = interaction.guild.roles.cache.get(roleId);
          description += `• ${role?.name || `Unknown Role (${roleId})`}\n`;
        }
      } else {
        description += '• Không có\n';
      }

      embed.setDescription(description);
      return await interaction.editReply({ embeds: [embed] });
  }
}

async function handleUnlock(interaction) {
  try {
    const { default: AntiRaidManager } = await import('../managers/antiRaidManager.mjs');
    const antiRaidManager = new AntiRaidManager(interaction.client);
    
    await antiRaidManager.unlockGuild(interaction.guild);
    
    return await interaction.editReply('🔓 Server đã được mở khóa thành công!');
  } catch (error) {
    console.error('Unlock error:', error);
    return await interaction.editReply('❌ Có lỗi khi mở khóa server!');
  }
}