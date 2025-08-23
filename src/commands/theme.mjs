import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import User from '../models/User.mjs';
import ProfileTheme from '../models/ProfileTheme.mjs';
import { formatCurrency, errorEmbed, successEmbed } from './util.mjs';

// Available themes
const THEMES = {
  default: {
    name: 'Mặc Định',
    description: 'Theme cơ bản của bot',
    price: 0,
    colors: { bg: '#48dbfb', accent: '#ff6b6b', text: '#ffffff' },
    icon: '🎣',
    rarity: 'common'
  },
  ocean: {
    name: 'Đại Dương',
    description: 'Theme xanh biển sâu thẳm',
    price: 5000,
    colors: { bg: '#006ba6', accent: '#0496ff', text: '#ffffff' },
    icon: '🌊',
    rarity: 'rare'
  },
  sunset: {
    name: 'Hoàng Hôn',
    description: 'Theme màu hoàng hôn ấm áp',
    price: 7500,
    colors: { bg: '#ff6b35', accent: '#f7931e', text: '#ffffff' },
    icon: '🌅',
    rarity: 'rare'
  },
  galaxy: {
    name: 'Thiên Hà',
    description: 'Theme vũ trụ lung linh',
    price: 15000,
    colors: { bg: '#2d1b69', accent: '#9d4edd', text: '#ffffff' },
    icon: '🌌',
    rarity: 'epic',
    effects: ['sparkles', 'glow']
  },
  golden: {
    name: 'Hoàng Kim',
    description: 'Theme vàng sang trọng',
    price: 25000,
    colors: { bg: '#b8860b', accent: '#ffd700', text: '#000000' },
    icon: '👑',
    rarity: 'legendary',
    effects: ['rainbow', 'glow']
  },
  neon: {
    name: 'Neon',
    description: 'Theme neon sáng chói',
    price: 20000,
    colors: { bg: '#0d1117', accent: '#00ff88', text: '#ffffff' },
    icon: '⚡',
    rarity: 'epic',
    effects: ['glow', 'animated']
  }
};

export const data = new SlashCommandBuilder()
    .setName('theme')
    .setDescription('Tùy chỉnh giao diện profile')
    .addSubcommand(subcommand =>
        subcommand
            .setName('shop')
            .setDescription('Xem shop themes'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('buy')
            .setDescription('Mua theme mới')
            .addStringOption(option =>
                option.setName('theme')
                    .setDescription('Theme muốn mua')
                    .setRequired(true)
                    .addChoices(
                        ...Object.entries(THEMES).map(([id, theme]) => ({
                            name: `${theme.icon} ${theme.name} - ${formatCurrency(theme.price)}`,
                            value: id
                        }))
                    )))
    .addSubcommand(subcommand =>
        subcommand
            .setName('equip')
            .setDescription('Trang bị theme')
            .addStringOption(option =>
                option.setName('theme')
                    .setDescription('Theme muốn trang bị')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('customize')
            .setDescription('Tùy chỉnh profile'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('preview')
            .setDescription('Xem trước profile với theme')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('Người dùng muốn xem profile')
                    .setRequired(false)));

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
        case 'shop':
            await handleShop(interaction);
            break;
        case 'buy':
            await handleBuy(interaction);
            break;
        case 'equip':
            await handleEquip(interaction);
            break;
        case 'customize':
            await handleCustomize(interaction);
            break;
        case 'preview':
            await handlePreview(interaction);
            break;
    }
}

async function handleShop(interaction) {
    const embed = new EmbedBuilder()
        .setColor('#48dbfb')
        .setTitle('🎨 Theme Shop')
        .setDescription('Tùy chỉnh giao diện profile của bạn!')
        .setTimestamp();
    
    for (const [id, theme] of Object.entries(THEMES)) {
        const rarityEmoji = {
            common: '⚪',
            rare: '🔵', 
            epic: '🟣',
            legendary: '🟡'
        };
        
        const effectsText = theme.effects ? `\n✨ Hiệu ứng: ${theme.effects.join(', ')}` : '';
        
        embed.addFields({
            name: `${theme.icon} ${theme.name} ${rarityEmoji[theme.rarity]}`,
            value: `${theme.description}\n💰 Giá: ${formatCurrency(theme.price)}${effectsText}`,
            inline: true
        });
    }
    
    await interaction.reply({ embeds: [embed] });
}

async function handleBuy(interaction) {
    const themeId = interaction.options.getString('theme');
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    const theme = THEMES[themeId];
    if (!theme) {
        return interaction.reply({
            embeds: [errorEmbed('Theme không tồn tại!')],
            ephemeral: true
        });
    }
    
    let profile = await User.findOne({ userId, guildId });
    if (!profile) profile = await User.create({ userId, guildId });
    
    let profileTheme = await ProfileTheme.findOne({ userId, guildId });
    if (!profileTheme) {
        profileTheme = await ProfileTheme.create({
            userId,
            guildId,
            ownedThemes: ['default']
        });
    }
    
    // Check if already owned
    if (profileTheme.ownedThemes.includes(themeId)) {
        return interaction.reply({
            embeds: [errorEmbed('Bạn đã sở hữu theme này rồi!')],
            ephemeral: true
        });
    }
    
    // Check money
    if ((profile.coins || 0) < theme.price) {
        return interaction.reply({
            embeds: [errorEmbed(`Bạn cần ${formatCurrency(theme.price)} để mua theme này!`)],
            ephemeral: true
        });
    }
    
    // Purchase theme
    profile.coins = (profile.coins || 0) - theme.price;
    profileTheme.ownedThemes.push(themeId);
    
    // Apply effects if theme has them
    if (theme.effects) {
        for (const effect of theme.effects) {
            profileTheme.effects[effect] = true;
        }
    }
    
    await profile.save();
    await profileTheme.save();
    
    const embed = new EmbedBuilder()
        .setColor(theme.colors.bg)
        .setTitle('🎉 Mua Theme Thành Công!')
        .setDescription(`Bạn đã mua theme **${theme.icon} ${theme.name}**!`)
        .addFields(
            { name: '💰 Số tiền trả', value: formatCurrency(theme.price), inline: true },
            { name: '🪙 Số dư còn lại', value: formatCurrency(profile.coins), inline: true }
        )
        .setFooter({ text: 'Dùng /theme equip để trang bị theme!' })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

async function handleEquip(interaction) {
    const themeId = interaction.options.getString('theme');
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    let profileTheme = await ProfileTheme.findOne({ userId, guildId });
    if (!profileTheme) {
        profileTheme = await ProfileTheme.create({
            userId,
            guildId,
            ownedThemes: ['default']
        });
    }
    
    // Check if owned
    if (!profileTheme.ownedThemes.includes(themeId)) {
        return interaction.reply({
            embeds: [errorEmbed('Bạn chưa sở hữu theme này!')],
            ephemeral: true
        });
    }
    
    const theme = THEMES[themeId];
    if (!theme) {
        return interaction.reply({
            embeds: [errorEmbed('Theme không tồn tại!')],
            ephemeral: true
        });
    }
    
    // Equip theme
    profileTheme.activeTheme = themeId;
    profileTheme.customizations.backgroundColor = theme.colors.bg;
    profileTheme.customizations.accentColor = theme.colors.accent;
    profileTheme.customizations.textColor = theme.colors.text;
    profileTheme.customizations.profileIcon = theme.icon;
    
    await profileTheme.save();
    
    const embed = new EmbedBuilder()
        .setColor(theme.colors.bg)
        .setTitle('✅ Theme Đã Được Trang Bị!')
        .setDescription(`Bạn đang sử dụng theme **${theme.icon} ${theme.name}**`)
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

async function handleCustomize(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    let profileTheme = await ProfileTheme.findOne({ userId, guildId });
    if (!profileTheme) {
        profileTheme = await ProfileTheme.create({
            userId,
            guildId,
            ownedThemes: ['default']
        });
    }
    
    const embed = new EmbedBuilder()
        .setColor(profileTheme.customizations.backgroundColor)
        .setTitle('🎨 Tùy Chỉnh Profile')
        .setDescription('Chọn mục muốn tùy chỉnh:')
        .addFields(
            { name: '🎭 Status', value: profileTheme.showcase.status || 'Đang câu cá...', inline: true },
            { name: '😊 Mood', value: profileTheme.showcase.mood || '😊', inline: true },
            { name: '💭 Quote', value: profileTheme.showcase.quote || 'Chưa có quote', inline: false }
        )
        .setTimestamp();
    
    const statusButton = new ButtonBuilder()
        .setCustomId('theme_status')
        .setLabel('📝 Đổi Status')
        .setStyle(ButtonStyle.Primary);
    
    const moodButton = new ButtonBuilder()
        .setCustomId('theme_mood')
        .setLabel('😊 Đổi Mood')
        .setStyle(ButtonStyle.Secondary);
    
    const quoteButton = new ButtonBuilder()
        .setCustomId('theme_quote')
        .setLabel('💭 Đổi Quote')
        .setStyle(ButtonStyle.Success);
    
    const row = new ActionRowBuilder().addComponents(statusButton, moodButton, quoteButton);
    
    await interaction.reply({ embeds: [embed], components: [row] });
}

async function handlePreview(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const userId = targetUser.id;
    const guildId = interaction.guildId;
    
    let profile = await User.findOne({ userId, guildId });
    if (!profile) profile = { coins: 0, fishCaught: 0, level: 1 };
    
    let profileTheme = await ProfileTheme.findOne({ userId, guildId });
    if (!profileTheme) {
        profileTheme = {
            activeTheme: 'default',
            customizations: THEMES.default.colors,
            showcase: { status: 'Đang câu cá...', mood: '😊' }
        };
    }
    
    const activeTheme = THEMES[profileTheme.activeTheme] || THEMES.default;
    
    const embed = new EmbedBuilder()
        .setColor(profileTheme.customizations?.backgroundColor || activeTheme.colors.bg)
        .setTitle(`${profileTheme.customizations?.profileIcon || activeTheme.icon} Profile - ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
            { name: '💰 Số Dư', value: formatCurrency(profile.coins || 0), inline: true },
            { name: '🎣 Cá Đã Câu', value: `${profile.fishCaught || 0}`, inline: true },
            { name: '⭐ Level', value: `${profile.level || 1}`, inline: true },
            { name: '🎨 Theme', value: `${activeTheme.icon} ${activeTheme.name}`, inline: true },
            { name: '😊 Mood', value: profileTheme.showcase?.mood || '😊', inline: true },
            { name: '📝 Status', value: profileTheme.showcase?.status || 'Đang câu cá...', inline: false }
        )
        .setTimestamp();
    
    if (profileTheme.showcase?.quote) {
        embed.addFields({ name: '💭 Quote', value: `"${profileTheme.showcase.quote}"`, inline: false });
    }
    
    // Add effect indicators
    const effects = [];
    if (profileTheme.effects?.sparkles) effects.push('✨ Sparkles');
    if (profileTheme.effects?.rainbow) effects.push('🌈 Rainbow');
    if (profileTheme.effects?.glow) effects.push('💫 Glow');
    if (profileTheme.effects?.animated) effects.push('🎞️ Animated');
    
    if (effects.length > 0) {
        embed.addFields({ name: '🎪 Hiệu Ứng', value: effects.join(' • '), inline: false });
    }
    
    await interaction.reply({ embeds: [embed] });
}