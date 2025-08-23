import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import User from '../models/User.mjs';

export const data = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('[DEV] Ban người dùng khỏi toàn bộ hệ thống bot')
    .addSubcommand(subcommand =>
        subcommand
            .setName('user')
            .setDescription('Ban một người dùng')
            .addUserOption(option =>
                option.setName('target')
                    .setDescription('Người dùng cần ban')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('reason')
                    .setDescription('Lý do ban')
                    .setRequired(false)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('unban')
            .setDescription('Unban một người dùng')
            .addUserOption(option =>
                option.setName('target')
                    .setDescription('Người dùng cần unban')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('list')
            .setDescription('Xem danh sách người bị ban'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('check')
            .setDescription('Kiểm tra trạng thái ban của người dùng')
            .addUserOption(option =>
                option.setName('target')
                    .setDescription('Người dùng cần kiểm tra')
                    .setRequired(true)));

export async function execute(interaction) {
    // Check if user is authorized (DEV_IDS from .env)
    const devIds = process.env.DEV_IDS?.split(',') || [];
    if (!devIds.includes(interaction.user.id)) {
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('❌ Không Có Quyền')
            .setDescription('Bạn không có quyền sử dụng lệnh này.')
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'user':
            await handleBanUser(interaction);
            break;
        case 'unban':
            await handleUnbanUser(interaction);
            break;
        case 'list':
            await handleListBanned(interaction);
            break;
        case 'check':
            await handleCheckUser(interaction);
            break;
    }
}

async function handleBanUser(interaction) {
    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'Không có lý do';

    // Check if target is a dev (cannot ban devs)
    const devIds = process.env.DEV_IDS?.split(',') || [];
    if (devIds.includes(targetUser.id)) {
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('❌ Không Thể Ban')
            .setDescription('Không thể ban developer!')
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    try {
        // Update all user profiles across all guilds
        await User.updateMany(
            { userId: targetUser.id },
            { 
                $set: { 
                    banned: true,
                    bannedAt: new Date(),
                    bannedBy: interaction.user.id,
                    banReason: reason
                }
            }
        );

        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('🔨 Người Dùng Đã Bị Ban')
            .setDescription(`**${targetUser.tag}** đã bị ban khỏi toàn bộ hệ thống bot`)
            .addFields(
                { name: '👤 Người Bị Ban', value: `<@${targetUser.id}>`, inline: true },
                { name: '🛡️ Người Ban', value: `<@${interaction.user.id}>`, inline: true },
                { name: '📝 Lý Do', value: reason, inline: false },
                { name: '📅 Thời Gian', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        
        // Log to console
        console.log(`[BAN] ${targetUser.tag} (${targetUser.id}) banned by ${interaction.user.tag} - Reason: ${reason}`);
        
    } catch (error) {
        console.error('Error banning user:', error);
        
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('❌ Lỗi')
            .setDescription('Có lỗi xảy ra khi ban người dùng.')
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

async function handleUnbanUser(interaction) {
    const targetUser = interaction.options.getUser('target');

    try {
        // Update all user profiles across all guilds
        const result = await User.updateMany(
            { userId: targetUser.id },
            { 
                $unset: { 
                    banned: "",
                    bannedAt: "",
                    bannedBy: "",
                    banReason: ""
                }
            }
        );

        const embed = new EmbedBuilder()
            .setColor('#48dbfb')
            .setTitle('✅ Người Dùng Đã Được Unban')
            .setDescription(`**${targetUser.tag}** đã được unban khỏi hệ thống bot`)
            .addFields(
                { name: '👤 Người Được Unban', value: `<@${targetUser.id}>`, inline: true },
                { name: '🛡️ Người Unban', value: `<@${interaction.user.id}>`, inline: true },
                { name: '📊 Profiles Cập Nhật', value: `${result.modifiedCount}`, inline: true },
                { name: '📅 Thời Gian', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        
        // Log to console
        console.log(`[UNBAN] ${targetUser.tag} (${targetUser.id}) unbanned by ${interaction.user.tag}`);
        
    } catch (error) {
        console.error('Error unbanning user:', error);
        
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('❌ Lỗi')
            .setDescription('Có lỗi xảy ra khi unban người dùng.')
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

async function handleListBanned(interaction) {
    try {
        const bannedUsers = await User.find({ banned: true })
            .select('userId bannedAt bannedBy banReason')
            .limit(10)
            .sort({ bannedAt: -1 });

        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('📋 Danh Sách Người Bị Ban')
            .setTimestamp();

        if (bannedUsers.length === 0) {
            embed.setDescription('Không có ai bị ban hiện tại.');
        } else {
            const description = bannedUsers.map((user, index) => {
                const bannedDate = user.bannedAt ? `<t:${Math.floor(user.bannedAt.getTime() / 1000)}:R>` : 'N/A';
                return `**${index + 1}.** <@${user.userId}>\n📅 ${bannedDate}\n📝 ${user.banReason || 'Không có lý do'}\n`;
            }).join('\n');
            
            embed.setDescription(description);
        }

        await interaction.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Error listing banned users:', error);
        
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('❌ Lỗi')
            .setDescription('Có lỗi xảy ra khi lấy danh sách người bị ban.')
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

async function handleCheckUser(interaction) {
    const targetUser = interaction.options.getUser('target');

    try {
        const userProfile = await User.findOne({ userId: targetUser.id, banned: true });

        const embed = new EmbedBuilder()
            .setTitle(`🔍 Kiểm Tra Trạng Thái: ${targetUser.tag}`)
            .setTimestamp();

        if (userProfile && userProfile.banned) {
            embed.setColor('#ff6b6b')
                .setDescription('❌ **Người dùng này đã bị ban**')
                .addFields(
                    { name: '📅 Bị Ban Lúc', value: userProfile.bannedAt ? `<t:${Math.floor(userProfile.bannedAt.getTime() / 1000)}:F>` : 'N/A', inline: true },
                    { name: '🛡️ Bị Ban Bởi', value: userProfile.bannedBy ? `<@${userProfile.bannedBy}>` : 'N/A', inline: true },
                    { name: '📝 Lý Do', value: userProfile.banReason || 'Không có lý do', inline: false }
                );
        } else {
            embed.setColor('#48dbfb')
                .setDescription('✅ **Người dùng này không bị ban**');
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
        
    } catch (error) {
        console.error('Error checking user ban status:', error);
        
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('❌ Lỗi')
            .setDescription('Có lỗi xảy ra khi kiểm tra trạng thái người dùng.')
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

// Function to check if user is banned (to be used in other commands)
export async function isUserBanned(userId) {
    try {
        const user = await User.findOne({ userId, banned: true });
        return !!user;
    } catch (error) {
        console.error('Error checking ban status:', error);
        return false;
    }
}