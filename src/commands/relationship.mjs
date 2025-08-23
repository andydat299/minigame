import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import User from '../models/User.mjs';
import Relationship from '../models/Relationship.mjs';
import { formatCurrency, successEmbed, errorEmbed } from './util.mjs';

export const data = new SlashCommandBuilder()
    .setName('relationship')
    .setDescription('Hệ thống mối quan hệ xã hội')
    .addSubcommand(subcommand =>
        subcommand
            .setName('marry')
            .setDescription('Cầu hôn người khác')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('Người bạn muốn cầu hôn')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('message')
                    .setDescription('Lời cầu hôn của bạn')
                    .setRequired(false)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('befriend')
            .setDescription('Kết bạn với ai đó')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('Người bạn muốn kết bạn')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('mentor')
            .setDescription('Đề nghị làm mentor hoặc tìm mentor')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('Người bạn muốn làm mentor hoặc mentee')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('role')
                    .setDescription('Bạn muốn làm gì?')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Tôi muốn làm mentor', value: 'be_mentor' },
                        { name: 'Tôi muốn tìm mentor', value: 'find_mentor' }
                    )))
    .addSubcommand(subcommand =>
        subcommand
            .setName('rival')
            .setDescription('Thách đấu ai đó làm đối thủ')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('Đối thủ của bạn')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('status')
            .setDescription('Xem trạng thái mối quan hệ')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('Người bạn muốn xem mối quan hệ')
                    .setRequired(false)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('break')
            .setDescription('Kết thúc mối quan hệ')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('Người bạn muốn kết thúc mối quan hệ')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('type')
                    .setDescription('Loại mối quan hệ muốn kết thúc')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Hôn nhân', value: 'marriage' },
                        { name: 'Bạn bè', value: 'friendship' },
                        { name: 'Mentor-Mentee', value: 'mentorship' },
                        { name: 'Đối thủ', value: 'rivalry' }
                    )))
    .addSubcommand(subcommand =>
        subcommand
            .setName('list')
            .setDescription('Xem danh sách tất cả mối quan hệ của bạn'));

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
        case 'marry':
            await handleMarry(interaction);
            break;
        case 'befriend':
            await handleBefriend(interaction);
            break;
        case 'mentor':
            await handleMentor(interaction);
            break;
        case 'rival':
            await handleRival(interaction);
            break;
        case 'status':
            await handleStatus(interaction);
            break;
        case 'break':
            await handleBreak(interaction);
            break;
        case 'list':
            await handleList(interaction);
            break;
    }
}

async function handleMarry(interaction) {
    const targetUser = interaction.options.getUser('user');
    const message = interaction.options.getString('message') || 'Bạn có muốn kết hôn với tôi không? 💕';
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    if (targetUser.id === userId) {
        return interaction.reply({ 
            embeds: [errorEmbed('Bạn không thể kết hôn với chính mình!')], 
            ephemeral: true 
        });
    }
    
    // Check if already married
    const existingMarriage = await Relationship.findOne({
        guildId,
        $or: [
            { user1Id: userId, user2Id: targetUser.id },
            { user1Id: targetUser.id, user2Id: userId }
        ],
        type: 'marriage',
        status: 'accepted'
    });
    
    if (existingMarriage) {
        return interaction.reply({ 
            embeds: [errorEmbed('Một trong hai người đã kết hôn rồi!')], 
            ephemeral: true 
        });
    }
    
    // Check for pending proposal
    const pendingProposal = await Relationship.findOne({
        guildId,
        $or: [
            { user1Id: userId, user2Id: targetUser.id },
            { user1Id: targetUser.id, user2Id: userId }
        ],
        type: 'marriage',
        status: 'pending'
    });
    
    if (pendingProposal) {
        return interaction.reply({ 
            embeds: [errorEmbed('Đã có lời cầu hôn đang chờ phản hồi!')], 
            ephemeral: true 
        });
    }
    
    // Create proposal
    const proposal = await Relationship.create({
        guildId,
        user1Id: userId,
        user2Id: targetUser.id,
        type: 'marriage',
        status: 'pending',
        proposalMessage: message
    });
    
    const embed = new EmbedBuilder()
        .setColor('#ff69b4')
        .setTitle('💕 Lời Cầu Hôn')
        .setDescription(`<@${userId}> đã cầu hôn <@${targetUser.id}>!`)
        .addFields(
            { name: '💌 Lời nhắn', value: message, inline: false },
            { name: '💍 Chi phí', value: 'Miễn phí (tình yêu vô giá!)', inline: true }
        )
        .setFooter({ text: `${targetUser.username} có thể chấp nhận hoặc từ chối` })
        .setTimestamp();

    const acceptButton = new ButtonBuilder()
        .setCustomId(`marry_accept_${proposal._id}`)
        .setLabel('💕 Chấp Nhận')
        .setStyle(ButtonStyle.Success);

    const declineButton = new ButtonBuilder()
        .setCustomId(`marry_decline_${proposal._id}`)
        .setLabel('💔 Từ Chối')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(acceptButton, declineButton);
    
    await interaction.reply({ embeds: [embed], components: [row] });
}

async function handleBefriend(interaction) {
    const targetUser = interaction.options.getUser('user');
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    if (targetUser.id === userId) {
        return interaction.reply({ 
            embeds: [errorEmbed('Bạn không thể kết bạn với chính mình!')], 
            ephemeral: true 
        });
    }
    
    // Check existing friendship
    const existingFriend = await Relationship.findOne({
        guildId,
        $or: [
            { user1Id: userId, user2Id: targetUser.id },
            { user1Id: targetUser.id, user2Id: userId }
        ],
        type: 'friendship',
        status: { $in: ['accepted', 'pending'] }
    });
    
    if (existingFriend) {
        if (existingFriend.status === 'accepted') {
            return interaction.reply({ 
                embeds: [errorEmbed('Các bạn đã là bạn bè rồi!')], 
                ephemeral: true 
            });
        } else {
            return interaction.reply({ 
                embeds: [errorEmbed('Đã có lời mời kết bạn đang chờ!')], 
                ephemeral: true 
            });
        }
    }
    
    // Create friendship request
    const friendship = await Relationship.create({
        guildId,
        user1Id: userId,
        user2Id: targetUser.id,
        type: 'friendship',
        status: 'pending'
    });
    
    const embed = new EmbedBuilder()
        .setColor('#48dbfb')
        .setTitle('🤝 Lời Mời Kết Bạn')
        .setDescription(`<@${userId}> muốn kết bạn với <@${targetUser.id}>!`)
        .addFields(
            { name: '🎁 Bonus bạn bè', value: '+5% xu khi cùng hoạt động', inline: true },
            { name: '🎮 Hoạt động chung', value: 'Unlocks friend activities', inline: true }
        )
        .setFooter({ text: `${targetUser.username} có thể chấp nhận hoặc từ chối` })
        .setTimestamp();

    const acceptButton = new ButtonBuilder()
        .setCustomId(`friend_accept_${friendship._id}`)
        .setLabel('🤝 Kết Bạn')
        .setStyle(ButtonStyle.Success);

    const declineButton = new ButtonBuilder()
        .setCustomId(`friend_decline_${friendship._id}`)
        .setLabel('❌ Từ Chối')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(acceptButton, declineButton);
    
    await interaction.reply({ embeds: [embed], components: [row] });
}

async function handleMentor(interaction) {
    const targetUser = interaction.options.getUser('user');
    const role = interaction.options.getString('role');
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    if (targetUser.id === userId) {
        return interaction.reply({ 
            embeds: [errorEmbed('Bạn không thể tự mentor chính mình!')], 
            ephemeral: true 
        });
    }
    
    const mentorId = role === 'be_mentor' ? userId : targetUser.id;
    const menteeId = role === 'be_mentor' ? targetUser.id : userId;
    
    // Create mentorship
    const mentorship = await Relationship.create({
        guildId,
        user1Id: userId,
        user2Id: targetUser.id,
        type: 'mentorship',
        status: 'pending',
        mentorId,
        menteeId
    });
    
    const embed = new EmbedBuilder()
        .setColor('#feca57')
        .setTitle('🎓 Đề Nghị Mentorship')
        .setDescription(role === 'be_mentor' 
            ? `<@${userId}> muốn làm mentor cho <@${targetUser.id}>!`
            : `<@${userId}> muốn <@${targetUser.id}> làm mentor!`)
        .addFields(
            { name: '📚 Lợi ích Mentor', value: '+10% xu từ mentee success', inline: true },
            { name: '🎯 Lợi ích Mentee', value: '+15% XP và giảm 50% fishing cost', inline: true }
        )
        .setFooter({ text: `${targetUser.username} có thể chấp nhận hoặc từ chối` })
        .setTimestamp();

    const acceptButton = new ButtonBuilder()
        .setCustomId(`mentor_accept_${mentorship._id}`)
        .setLabel('📚 Chấp Nhận')
        .setStyle(ButtonStyle.Success);

    const declineButton = new ButtonBuilder()
        .setCustomId(`mentor_decline_${mentorship._id}`)
        .setLabel('❌ Từ Chối')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(acceptButton, declineButton);
    
    await interaction.reply({ embeds: [embed], components: [row] });
}

async function handleRival(interaction) {
    const targetUser = interaction.options.getUser('user');
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    if (targetUser.id === userId) {
        return interaction.reply({ 
            embeds: [errorEmbed('Bạn không thể tự thách đấu chính mình!')], 
            ephemeral: true 
        });
    }
    
    // Create rivalry
    const rivalry = await Relationship.create({
        guildId,
        user1Id: userId,
        user2Id: targetUser.id,
        type: 'rivalry',
        status: 'pending'
    });
    
    const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('⚔️ Thách Đấu Rivalry')
        .setDescription(`<@${userId}> thách đấu <@${targetUser.id}> làm đối thủ!`)
        .addFields(
            { name: '🔥 Lợi ích', value: '+20% XP khi thắng rival activities', inline: true },
            { name: '🏆 Thi đấu', value: 'Unlock special rivalry competitions', inline: true }
        )
        .setFooter({ text: `${targetUser.username} có thể chấp nhận thách đấu` })
        .setTimestamp();

    const acceptButton = new ButtonBuilder()
        .setCustomId(`rival_accept_${rivalry._id}`)
        .setLabel('⚔️ Thách Đấu')
        .setStyle(ButtonStyle.Danger);

    const declineButton = new ButtonBuilder()
        .setCustomId(`rival_decline_${rivalry._id}`)
        .setLabel('🏳️ Từ Chối')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(acceptButton, declineButton);
    
    await interaction.reply({ embeds: [embed], components: [row] });
}

async function handleStatus(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    const relationships = await Relationship.find({
        guildId,
        $or: [
            { user1Id: targetUser.id },
            { user2Id: targetUser.id }
        ],
        status: 'accepted'
    });
    
    if (relationships.length === 0) {
        return interaction.reply({
            embeds: [successEmbed('💝 Trạng Thái Mối Quan Hệ', `${targetUser.username} chưa có mối quan hệ nào.`)],
            ephemeral: true
        });
    }
    
    const embed = new EmbedBuilder()
        .setColor('#48dbfb')
        .setTitle(`💝 Mối Quan Hệ - ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();
    
    const marriage = relationships.find(r => r.type === 'marriage');
    const friends = relationships.filter(r => r.type === 'friendship');
    const mentorships = relationships.filter(r => r.type === 'mentorship');
    const rivalries = relationships.filter(r => r.type === 'rivalry');
    
    if (marriage) {
        const partnerId = marriage.user1Id === targetUser.id ? marriage.user2Id : marriage.user1Id;
        const daysSince = Math.floor((Date.now() - marriage.marriageDate) / (1000 * 60 * 60 * 24));
        embed.addFields({
            name: '💕 Hôn Nhân',
            value: `Vợ/Chồng: <@${partnerId}>\n📅 ${daysSince} ngày kết hôn\n🎁 ${marriage.bonusesEarned} bonus đã nhận`,
            inline: false
        });
    }
    
    if (friends.length > 0) {
        const friendList = friends.map(f => {
            const friendId = f.user1Id === targetUser.id ? f.user2Id : f.user1Id;
            return `<@${friendId}> (Lv.${f.friendshipLevel})`;
        }).join(', ');
        embed.addFields({
            name: `🤝 Bạn Bè (${friends.length})`,
            value: friendList,
            inline: false
        });
    }
    
    if (mentorships.length > 0) {
        const mentorshipList = mentorships.map(m => {
            const isMentor = m.mentorId === targetUser.id;
            const otherId = isMentor ? m.menteeId : m.mentorId;
            return `${isMentor ? '👨‍🏫' : '👨‍🎓'} <@${otherId}> (${m.lessonsCompleted} lessons)`;
        }).join('\n');
        embed.addFields({
            name: '🎓 Mentorship',
            value: mentorshipList,
            inline: false
        });
    }
    
    if (rivalries.length > 0) {
        const rivalryList = rivalries.map(r => {
            const rivalId = r.user1Id === targetUser.id ? r.user2Id : r.user1Id;
            const isUser1 = r.user1Id === targetUser.id;
            const wins = isUser1 ? r.rivalryScore.user1Wins : r.rivalryScore.user2Wins;
            const losses = isUser1 ? r.rivalryScore.user2Wins : r.rivalryScore.user1Wins;
            return `⚔️ <@${rivalId}> (${wins}W-${losses}L)`;
        }).join('\n');
        embed.addFields({
            name: '⚔️ Đối Thủ',
            value: rivalryList,
            inline: false
        });
    }
    
    await interaction.reply({ embeds: [embed] });
}

async function handleBreak(interaction) {
    const targetUser = interaction.options.getUser('user');
    const type = interaction.options.getString('type');
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    const relationship = await Relationship.findOne({
        guildId,
        $or: [
            { user1Id: userId, user2Id: targetUser.id },
            { user1Id: targetUser.id, user2Id: userId }
        ],
        type,
        status: 'accepted'
    });
    
    if (!relationship) {
        return interaction.reply({
            embeds: [errorEmbed(`Không tìm thấy mối quan hệ ${type} với người này!`)],
            ephemeral: true
        });
    }
    
    relationship.status = 'broken';
    await relationship.save();
    
    const typeNames = {
        marriage: 'hôn nhân',
        friendship: 'bạn bè', 
        mentorship: 'mentor-mentee',
        rivalry: 'đối thủ'
    };
    
    const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('💔 Mối Quan Hệ Đã Kết Thúc')
        .setDescription(`Mối quan hệ ${typeNames[type]} giữa <@${userId}> và <@${targetUser.id}> đã kết thúc.`)
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

async function handleList(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    const relationships = await Relationship.find({
        guildId,
        $or: [{ user1Id: userId }, { user2Id: userId }],
        status: 'accepted'
    });
    
    if (relationships.length === 0) {
        return interaction.reply({
            embeds: [successEmbed('📋 Danh Sách Mối Quan Hệ', 'Bạn chưa có mối quan hệ nào.')],
            ephemeral: true
        });
    }
    
    const embed = new EmbedBuilder()
        .setColor('#48dbfb')
        .setTitle('📋 Danh Sách Mối Quan Hệ Của Bạn')
        .setTimestamp();
    
    const groupedRelationships = relationships.reduce((acc, rel) => {
        if (!acc[rel.type]) acc[rel.type] = [];
        acc[rel.type].push(rel);
        return acc;
    }, {});
    
    for (const [type, rels] of Object.entries(groupedRelationships)) {
        const typeEmojis = {
            marriage: '💕',
            friendship: '🤝',
            mentorship: '🎓',
            rivalry: '⚔️'
        };
        
        const relList = rels.map(rel => {
            const otherId = rel.user1Id === userId ? rel.user2Id : rel.user1Id;
            return `<@${otherId}>`;
        }).join(', ');
        
        embed.addFields({
            name: `${typeEmojis[type]} ${type.charAt(0).toUpperCase() + type.slice(1)} (${rels.length})`,
            value: relList,
            inline: false
        });
    }
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
}