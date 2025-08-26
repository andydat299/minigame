import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { migrateToGlobalCurrency } from '../scripts/migrateToGlobal.mjs';

export const data = new SlashCommandBuilder()
  .setName('migrate')
  .setDescription('Chuyển đổi từ hệ thống tiền tệ theo server sang global (ADMIN ONLY)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('start')
      .setDescription('Bắt đầu quá trình migration')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('status')
      .setDescription('Kiểm tra trạng thái migration')
  );

let migrationInProgress = false;
let migrationStatus = null;

export async function execute(interaction) {
  try {
    await interaction.deferReply();
    
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'start') {
      return await handleStartMigration(interaction);
    } else if (subcommand === 'status') {
      return await handleMigrationStatus(interaction);
    }

  } catch (error) {
    console.error('Migration command error:', error);
    return interaction.editReply('❌ Có lỗi xảy ra khi thực hiện migration!');
  }
}

async function handleStartMigration(interaction) {
  if (migrationInProgress) {
    return interaction.editReply('⚠️ Migration đang trong quá trình thực hiện!');
  }

  const warningEmbed = new EmbedBuilder()
    .setColor('#ff9500')
    .setTitle('⚠️ Cảnh Báo: Migration Hệ Thống')
    .setDescription('**Bạn chuẩn bị chuyển đổi từ hệ thống tiền tệ theo server sang hệ thống global!**')
    .addFields([
      {
        name: '📝 Những gì sẽ thay đổi:',
        value: `• **Xu** sẽ được chia sẻ trên tất cả server\n• **Cần câu** và **inventory** trở thành global\n• **Level/EXP** vẫn riêng biệt theo server\n• **Relationships** vẫn riêng biệt theo server`,
        inline: false
      },
      {
        name: '🔄 Quá trình migration:',
        value: `• Hệ thống sẽ tự động gộp dữ liệu từ tất cả server\n• Lấy số xu cao nhất từ các server\n• Gộp thống kê câu cá\n• Dữ liệu cũ vẫn được giữ lại để backup`,
        inline: false
      },
      {
        name: '⏱️ Thời gian dự kiến:',
        value: `• 2-5 phút tùy thuộc vào số lượng users\n• Bot có thể lag trong quá trình migration\n• **Không được tắt bot** trong lúc này!`,
        inline: false
      }
    ])
    .setTimestamp();

  await interaction.editReply({ embeds: [warningEmbed] });

  // Wait 5 seconds then start migration
  setTimeout(async () => {
    try {
      migrationInProgress = true;
      migrationStatus = 'Starting migration...';

      const progressEmbed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🔄 Đang Thực Hiện Migration...')
        .setDescription('⏳ Vui lòng chờ, đang chuyển đổi hệ thống...')
        .addFields([
          {
            name: '📊 Trạng thái',
            value: '🟡 Đang bắt đầu...',
            inline: false
          }
        ])
        .setTimestamp();

      await interaction.editReply({ embeds: [progressEmbed] });

      // Start migration in background
      migrateToGlobalCurrency()
        .then(() => {
          migrationInProgress = false;
          migrationStatus = 'completed';
        })
        .catch((error) => {
          migrationInProgress = false;
          migrationStatus = `failed: ${error.message}`;
        });

    } catch (error) {
      migrationInProgress = false;
      migrationStatus = `error: ${error.message}`;
      console.error('Migration start error:', error);
    }
  }, 5000);
}

async function handleMigrationStatus(interaction) {
  const embed = new EmbedBuilder()
    .setTimestamp();

  if (migrationInProgress) {
    embed
      .setColor('#f39c12')
      .setTitle('🔄 Migration Đang Chạy')
      .setDescription('Migration đang trong quá trình thực hiện...')
      .addFields([
        {
          name: '📊 Trạng thái',
          value: migrationStatus || 'Đang xử lý...',
          inline: false
        },
        {
          name: '⚠️ Lưu ý',
          value: 'Vui lòng không tắt bot cho đến khi hoàn thành!',
          inline: false
        }
      ]);
  } else if (migrationStatus === 'completed') {
    embed
      .setColor('#27ae60')
      .setTitle('✅ Migration Hoàn Thành')
      .setDescription('Hệ thống đã được chuyển đổi thành công sang global currency!')
      .addFields([
        {
          name: '🎉 Kết quả',
          value: 'Tất cả users đã được chuyển đổi sang hệ thống global',
          inline: false
        },
        {
          name: '🔄 Bước tiếp theo',
          value: 'Có thể bắt đầu sử dụng các lệnh với hệ thống global',
          inline: false
        }
      ]);
  } else if (migrationStatus && migrationStatus.startsWith('failed')) {
    embed
      .setColor('#e74c3c')
      .setTitle('❌ Migration Thất Bại')
      .setDescription('Có lỗi xảy ra trong quá trình migration')
      .addFields([
        {
          name: '🐛 Lỗi',
          value: migrationStatus,
          inline: false
        },
        {
          name: '🔧 Khắc phục',
          value: 'Kiểm tra logs và thử lại',
          inline: false
        }
      ]);
  } else {
    embed
      .setColor('#95a5a6')
      .setTitle('⏸️ Chưa Có Migration')
      .setDescription('Migration chưa được thực hiện')
      .addFields([
        {
          name: '📝 Hướng dẫn',
          value: 'Sử dụng `/migrate start` để bắt đầu',
          inline: false
        }
      ]);
  }

  return interaction.editReply({ embeds: [embed] });
}