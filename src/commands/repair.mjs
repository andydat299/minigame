import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import User from '../models/User.mjs';
import { getRepairCost, getMaxDurability } from '../game/durability.mjs';
import { formatCurrency, successEmbed, errorEmbed } from './util.mjs';

export const data = new SlashCommandBuilder()
    .setName('repair')
    .setDescription('Sửa chữa cần câu của bạn')
    .addIntegerOption(option =>
        option.setName('amount')
            .setDescription('Số điểm độ bền muốn sửa (để trống = sửa hết)')
            .setRequired(false)
            .setMinValue(1));

export async function execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    
    let profile = await User.findOne({ userId, guildId });
    if (!profile) profile = await User.create({ userId, guildId });

    const currentDurability = profile.rodDurability || 0;
    const maxDurability = getMaxDurability(profile.rodLevel);
    const requestedAmount = interaction.options.getInteger('amount');
    
    // Update max durability if it's outdated
    if (profile.maxDurability !== maxDurability) {
        profile.maxDurability = maxDurability;
    }

    // Check if rod needs repair
    if (currentDurability >= maxDurability) {
        const embed = new EmbedBuilder()
            .setColor('#48dbfb')
            .setTitle('🔧 Cần Câu Không Cần Sửa')
            .setDescription('Cần câu của bạn đã ở trạng thái hoàn hảo!')
            .addFields(
                { name: '🎣 Độ Bền Hiện Tại', value: `${currentDurability}/${maxDurability}`, inline: true },
                { name: '📊 Tình Trạng', value: '✅ Hoàn hảo', inline: true }
            )
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
    }

    // Calculate repair amount
    const maxRepairNeeded = maxDurability - currentDurability;
    const repairAmount = requestedAmount ? Math.min(requestedAmount, maxRepairNeeded) : maxRepairNeeded;
    
    // Calculate cost
    const totalCost = getRepairCost(profile.rodLevel, repairAmount);
    
    // Check if user has enough coins
    if ((profile.coins || 0) < totalCost) {
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('💰 Không Đủ Tiền')
            .setDescription(`Bạn cần ${formatCurrency(totalCost)} để sửa ${repairAmount} điểm độ bền.`)
            .addFields(
                { name: '🪙 Tiền Hiện Có', value: formatCurrency(profile.coins || 0), inline: true },
                { name: '💸 Chi Phí', value: formatCurrency(totalCost), inline: true },
                { name: '❌ Thiếu', value: formatCurrency(totalCost - (profile.coins || 0)), inline: true }
            )
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Perform repair
    profile.rodDurability = currentDurability + repairAmount;
    profile.coins = (profile.coins || 0) - totalCost;
    await profile.save();

    // Create success embed
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🔧 Sửa Chữa Thành Công')
        .setDescription(`Đã sửa chữa cần câu của bạn!`)
        .addFields(
            { name: '🎣 Độ Bền', value: `${currentDurability} → ${profile.rodDurability}/${maxDurability}`, inline: true },
            { name: '💸 Chi Phí', value: formatCurrency(totalCost), inline: true },
            { name: '🪙 Tiền Còn Lại', value: formatCurrency(profile.coins), inline: true }
        )
        .setTimestamp();

    // Add condition status
    let conditionText = '';
    let conditionEmoji = '';
    const durabilityPercent = (profile.rodDurability / maxDurability) * 100;
    
    if (durabilityPercent >= 90) {
        conditionText = 'Như mới';
        conditionEmoji = '✨';
    } else if (durabilityPercent >= 70) {
        conditionText = 'Tốt';
        conditionEmoji = '✅';
    } else if (durabilityPercent >= 50) {
        conditionText = 'Khá';
        conditionEmoji = '🟡';
    } else if (durabilityPercent >= 30) {
        conditionText = 'Trung bình';
        conditionEmoji = '🟠';
    } else {
        conditionText = 'Kém';
        conditionEmoji = '🔴';
    }

    embed.addFields({ name: '📊 Tình Trạng', value: `${conditionEmoji} ${conditionText}`, inline: true });

    await interaction.reply({ embeds: [embed] });
}