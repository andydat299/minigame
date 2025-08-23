import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import User from '../models/User.mjs';
import { errorEmbed, successEmbed } from './util.mjs';

export const data = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban người dùng khỏi việc sử dụng bot')
    .addSubcommand(subcommand =>
        subcommand
            .setName('user')
            .setDescription('Ban một người dùng')
            .addUserOption(option =>
                option.setName('user')
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
                option.setName('user')
                    .setDescription('Người dùng cần unban')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('list')
            .setDescription('Xem danh sách người dùng bị ban'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    // Check permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        return interaction.reply({
            embeds: [errorEmbed('Bạn không có quyền sử dụng lệnh này!')],
            ephemeral: true
        });
    }
    
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
    }
}

async function handleBanUser(interaction) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Không có lý do';
    const guildId = interaction.guildId;
    
    // Check if trying to ban self
    if (targetUser.id === interaction.user.id) {
        return interaction.reply({
            embeds: [errorEmbed('Bạn không thể ban chính mình!')],
            ephemeral: true
        });
    }
    
    // Find or create user profile
    let targetProfile = await User.findOne({ userId: targetUser.id, guildId });
    if (!targetProfile) {
        targetProfile = await User.create({ userId: targetUser.id, guildId });
    }
    
    // Check if already banned
    if (targetProfile.banned === true) {
        return interaction.reply({
            embeds: [errorEmbed(`${targetUser.tag} đã bị ban rồi!`)],
            ephemeral: true
        });
    }
    
    // Ban the user
    targetProfile.banned = true;
    targetProfile.banReason = reason;
    targetProfile.bannedAt = new Date();
    targetProfile.bannedBy = interaction.user.id;
    await targetProfile.save();
    
    console.log(`🚫 User ${targetUser.tag} banned by ${interaction.user.tag} in ${interaction.guild.name}`);
    
    const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('🚫 Người Dùng Đã Bị Ban')
        .addFields(
            { name: '👤 Người bị ban', value: `${targetUser.tag} (${targetUser.id})`, inline: false },
            { name: '👮 Người ban', value: `${interaction.user.tag}`, inline: false },
            { name: '📝 Lý do', value: reason, inline: false },
            { name: '⏰ Thời gian', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

async function handleUnbanUser(interaction) {
    const targetUser = interaction.options.getUser('user');
    const guildId = interaction.guildId;
    
    // Find user profile
    const targetProfile = await User.findOne({ userId: targetUser.id, guildId });
    if (!targetProfile || targetProfile.banned !== true) {
        return interaction.reply({
            embeds: [errorEmbed(`${targetUser.tag} không bị ban!`)],
            ephemeral: true
        });
    }
    
    // Unban the user
    targetProfile.banned = false;
    targetProfile.banReason = null;
    targetProfile.bannedAt = null;
    targetProfile.bannedBy = null;
    await targetProfile.save();
    
    console.log(`✅ User ${targetUser.tag} unbanned by ${interaction.user.tag} in ${interaction.guild.name}`);
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Người Dùng Đã Được Unban')
        .addFields(
            { name: '👤 Người được unban', value: `${targetUser.tag} (${targetUser.id})`, inline: false },
            { name: '👮 Người unban', value: `${interaction.user.tag}`, inline: false },
            { name: '⏰ Thời gian', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

async function handleListBanned(interaction) {
    const guildId = interaction.guildId;
    
    const bannedUsers = await User.find({ guildId, banned: true }).limit(20);
    
    if (bannedUsers.length === 0) {
        return interaction.reply({
            embeds: [successEmbed('📝 Danh Sách Ban', 'Không có người dùng nào bị ban.')],
            ephemeral: true
        });
    }
    
    const banList = bannedUsers.map(user => {
        const bannedDate = user.bannedAt ? `<t:${Math.floor(user.bannedAt.getTime() / 1000)}:R>` : 'Không rõ';
        return `**<@${user.userId}>**\n📝 ${user.banReason || 'Không có lý do'}\n⏰ ${bannedDate}\n`;
    }).join('\n');
    
    const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('📝 Danh Sách Người Dùng Bị Ban')
        .setDescription(banList)
        .setFooter({ text: `Tổng: ${bannedUsers.length} người dùng` })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}