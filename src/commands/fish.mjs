import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder } from 'discord.js';
import User from '../models/User.mjs';
import GuildConfig from '../models/GuildConfig.mjs';
import { rarityWeightsForRod, pickRarity, pickFishByRarity, boostWeightsLight, boostWeightsStrong, enforceMinRarity } from '../game/fishData.mjs';
import { successEmbed, errorEmbed, infoEmbed, formatCurrency } from './util.mjs';
import { FISH_COOLDOWN_SEC } from '../config.mjs';
import { isEffectActive } from '../game/effects.mjs';
import { applyEventBonus, currentEvent } from './fishingevent.mjs';
import { getDurabilityLoss, getMaxDurability, isRodCritical, shouldWarnDurability, ROD_DURABILITY_CONFIG } from '../game/durability.mjs';
import { updateQuestProgress } from '../game/questManager.mjs';

export const data = new SlashCommandBuilder().setName('fish').setDescription('Câu cá (mini-game bấm nút)');

export async function execute(interaction) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  let profile = await User.findOne({ userId, guildId });
  if (!profile) {
    profile = await User.create({ 
      userId, 
      guildId,
      freeFishingTries: 10 // Người mới có 10 lần miễn phí
    });
  }

  // Check if user has free tries or bait
  const hasFreeTries = (profile.freeFishingTries || 0) > 0;
  const hasBait = (profile.bait || 0) > 0;
  
  if (!hasFreeTries && !hasBait) {
    return interaction.reply({
      embeds: [errorEmbed('🎣 Bạn không có mồi để câu cá!\n\n💡 **Cách lấy mồi:**\n• 🛒 Mua tại `/shop`\n• 🎁 Nhận miễn phí từ `/daily`\n• 🎮 Người mới có 10 lần câu miễn phí!')],
      ephemeral: true
    });
  }

  const now = new Date();
  if (profile.lastFishAt) {
    const diff = (now - profile.lastFishAt) / 1000;
    if (diff < FISH_COOLDOWN_SEC) { const wait = Math.ceil(FISH_COOLDOWN_SEC - diff); await interaction.reply({ ephemeral: true, embeds: [errorEmbed(`Bạn cần đợi ${wait}s nữa để câu tiếp.`)] }); return; }
  }

  // Check if user has enough coins to fish (10 xu per attempt)
  const fishingCost = 10;
  if ((profile.coins || 0) < fishingCost) {
    await interaction.reply({ 
      ephemeral: true, 
      embeds: [errorEmbed(`Bạn cần ${formatCurrency(fishingCost)} để câu cá!`)] 
    });
    return;
  }

  // Check rod durability
  const currentDurability = profile.rodDurability || 0;
  const maxDurability = getMaxDurability(profile.rodLevel);
  
  // Update max durability if needed
  if (profile.maxDurability !== maxDurability) {
    profile.maxDurability = maxDurability;
  }

  // Check if rod is broken
  if (currentDurability < ROD_DURABILITY_CONFIG.MIN_DURABILITY_TO_FISH) {
    await interaction.reply({ 
      ephemeral: true, 
      embeds: [errorEmbed(`🔧 Cần câu của bạn đã hỏng! Sử dụng \`/repair\` để sửa chữa.\n\n**Độ bền:** ${currentDurability}/${maxDurability}`)] 
    });
    return;
  }

  const baseClicks = Math.floor(Math.random() * 4) + 3; // 3..6
  const reduce = isEffectActive(profile,'vacuum') ? 2 : 0;
  const requiredClicks = Math.max(1, baseClicks - reduce);
  let clicks = 0;
  const button = new ButtonBuilder().setCustomId('fish_pull').setLabel('🎣 Kéo').setStyle(ButtonStyle.Primary);
  const row = new ActionRowBuilder().addComponents(button);

  await interaction.reply({ embeds: [infoEmbed("Câu cá", `Nhấn nút **${requiredClicks} lần** để kéo cá! (20s timeout)`)], components: [row] });
  const msg = await interaction.fetchReply();
  const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 20_000, filter: (i)=> i.user.id===userId && i.customId==='fish_pull' });

  collector.on('collect', async (i)=>{
    clicks++;
    if (clicks >= requiredClicks) { collector.stop('done'); await i.deferUpdate(); }
    else { await i.update({ embeds: [infoEmbed("Câu cá", `Tiến độ: **${clicks}/${requiredClicks}**`)], components: [row] }); }
  });

  collector.on('end', async (_c, reason)=>{
    if (reason !== 'done') { await interaction.editReply({ embeds:[errorEmbed("Bạn đã hụt cá (hết thời gian)!")], components: [] }); return; }

    // Tính trọng số rơi
    let weights = rarityWeightsForRod(profile.rodLevel);
    const usedBait = (profile.bait||0) > 0;
    if (usedBait) { weights = boostWeightsLight(weights); profile.bait = Math.max(0, (profile.bait||0) - 1); }
    if (isEffectActive(profile,'lure') || isEffectActive(profile,'charm')) weights = boostWeightsLight(weights);
    if (isEffectActive(profile,'relic')) weights = boostWeightsStrong(weights);
    if (isEffectActive(profile,'sonar')) weights = enforceMinRarity(weights, 'rare');

    // Apply durability penalty if rod is in critical condition
    if (isRodCritical(currentDurability)) {
      // Reduce catch quality when rod is critical
      weights.common *= 2; // Increase common fish chance
      weights.rare *= 0.7; // Reduce rare fish chance
      weights.epic *= 0.5; // Reduce epic fish chance
      weights.legendary *= 0.3; // Reduce legendary fish chance
    }

      // Boss drop (unchanged)
  let gotBoss = false;
  if (Math.random() < 0.01) { // 1% chance
    gotBoss = true;
  }

    // Roll cá
    const rarity = pickRarity(weights);
    const fish = pickFishByRarity(rarity);
    const item = profile.inventory.find(i => i.name === fish.name);
    let caughtCount = 1;
    if (item) item.count += 1; else profile.inventory.push({ name: fish.name, count: 1 });

    // Double Hook
    if (isEffectActive(profile,'doublehook') && Math.random() < 0.30) {
      const same = profile.inventory.find(i => i.name === fish.name);
      same.count += 1; caughtCount += 1;
    }

    // Apply fishing event bonuses if active
    const eventResult = applyEventBonus(interaction.user.id, 0, fish.name); // Set base value to 0
    const isEventActive = eventResult.isEventCatch;

    // Reduce durability
    const durabilityLoss = getDurabilityLoss(profile.rodLevel);
    const newDurability = Math.max(0, currentDurability - durabilityLoss);
    profile.rodDurability = newDurability;

    // Deduct fishing cost and add fish to inventory instead of giving coins
    profile.coins = (profile.coins || 0) - fishingCost;
    
    // Add fish to inventory
    const fishInInventory = profile.inventory.find(item => item.name === fish.name);
    if (fishInInventory) {
        fishInInventory.count += caughtCount;
    } else {
        profile.inventory.push({ name: fish.name, count: caughtCount });
    }
    
    // Add boss drop to inventory if caught
    if (gotBoss) {
        const bossItem = profile.inventory.find(item => item.name === 'Vảy rồng');
        if (bossItem) {
            bossItem.count += 1;
        } else {
            profile.inventory.push({ name: 'Vảy rồng', count: 1 });
        }
    }

    profile.fishCaught = (profile.fishCaught || 0) + caughtCount + (gotBoss?1:0);
    profile.lastFishAt = new Date();
    await profile.save();

    // Update quest progress (remove coins earned quest progress)
    const completedQuests = await updateQuestProgress(interaction.user.id, interaction.guildId, 'fishCatch', caughtCount);
    await updateQuestProgress(interaction.user.id, interaction.guildId, 'coinsSpend', fishingCost);

    let resultMessage = `Bạn đã câu được **${fish.name}** (*${rarity}*)${gotBoss?` và **Vảy rồng**`:''}.`;
    resultMessage += `\n\n💸 **Chi phí câu cá:** ${formatCurrency(fishingCost)}`;
    resultMessage += `\n📦 **Đã thêm vào kho:** ${fish.name} x${caughtCount}${gotBoss ? ', Vảy rồng x1' : ''}`;
    
    // Add durability loss information
    resultMessage += `\n\n🔧 **Độ bền cần câu:** ${currentDurability} → ${newDurability}/${maxDurability} (-${durabilityLoss})`;
    
    // Add durability warning if needed
    if (shouldWarnDurability(newDurability)) {
      if (newDurability <= ROD_DURABILITY_CONFIG.MIN_DURABILITY_TO_FISH) {
        resultMessage += `\n🔧 **CẢNH BÁO:** Cần câu đã hỏng! Sử dụng \`/repair\` để sửa chữa.`;
      } else if (isRodCritical(newDurability)) {
        resultMessage += `\n⚠️ **Cần câu sắp hỏng!** Hiệu suất giảm!`;
      } else {
        resultMessage += `\n🔧 Cần câu cần bảo dưỡng sớm.`;
      }
    }
    
    // Add event information if active
    if (isEventActive && currentEvent) {
        resultMessage += `\n\n🎉 **${currentEvent.name}** đang diễn ra! Bonus đã áp dụng cho giá trị cá!`;
        
        if (eventResult.specialItem) {
            resultMessage += `\n⭐ Bạn đã tìm thấy: **${eventResult.specialItem}**!`;
        }
    }

    // Add quest completion notifications
    if (completedQuests.length > 0) {
        const questNames = completedQuests.map(cq => cq.quest.name).join(', ');
        resultMessage += `\n\n🎯 **Quest hoàn thành:** ${questNames}`;
    }
    
    resultMessage += `\n\n💡 **Mẹo:** Sử dụng \`/sellall\` để bán cá và kiếm xu!`;

    // Send welcome message for brand new players
    if ((profile.freeFishingTries || 0) === 10 && (profile.fishCaught || 0) === 0) {
      await sendWelcomeMessage(interaction, profile);
    }

    await interaction.editReply({ embeds:[successEmbed(resultMessage)], components: [] });
  });
  
  // Add welcome message for new players with free fishing tries
  async function sendWelcomeMessage(interaction, profile) {
    if ((profile.freeFishingTries || 0) === 10 && (profile.fishCaught || 0) === 0) {
      const welcomeEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🎉 Chào Mừng Người Chơi Mới!')
        .setDescription('**Chúc mừng bạn đã tham gia hệ thống câu cá!**')
        .addFields(
          { name: '🎁 Quà Tặng Chào Mừng', value: '🆓 **10 lần câu cá miễn phí**\n🎣 Không cần mồi cho 10 lần đầu!', inline: false },
          { name: '🎯 Hướng Dẫn', value: '• Dùng `/fish` để bắt đầu câu cá\n• Dùng `/daily` để nhận thưởng hàng ngày\n• Dùng `/shop` để mua mồi khi hết miễn phí', inline: false },
          { name: '💡 Mẹo', value: 'Hãy tận dụng 10 lần miễn phí để tích lũy xu và mua cần câu tốt hơn!', inline: false }
        )
        .setFooter({ text: 'Chúc bạn câu được nhiều cá quý hiếm! 🐟' })
        .setTimestamp();
      
      await interaction.followUp({ embeds: [welcomeEmbed], ephemeral: true });
    }
  }

  // Gửi tin nhắn chào mừng nếu đủ điều kiện
  await sendWelcomeMessage(interaction, profile);
}

// Hàm tạo thanh độ bền visual
function createDurabilityBar(percentage) {
  const barLength = 10;
  const filledLength = Math.round((percentage / 100) * barLength);
  const emptyLength = barLength - filledLength;
  
  let bar = '';
  
  // Chọn emoji dựa trên phần trăm
  if (percentage >= 80) {
    bar = '🟩'.repeat(filledLength) + '⬜'.repeat(emptyLength);
  } else if (percentage >= 60) {
    bar = '🟨'.repeat(filledLength) + '⬜'.repeat(emptyLength);
  } else if (percentage >= 40) {
    bar = '🟧'.repeat(filledLength) + '⬜'.repeat(emptyLength);
  } else {
    bar = '🟥'.repeat(filledLength) + '⬜'.repeat(emptyLength);
  }
  
  return `\`[${bar}]\``;
}

// Hàm lấy thông tin độ bền
function getDurabilityInfo(percentage) {
  if (percentage >= 80) {
    return { color: '🟢', icon: '✨', status: 'Tuyệt vời' };
  } else if (percentage >= 60) {
    return { color: '🟡', icon: '⚡', status: 'Tốt' };
  } else if (percentage >= 40) {
    return { color: '🟠', icon: '⚠️', status: 'Trung bình' };
  } else if (percentage >= 20) {
    return { color: '🔴', icon: '💥', status: 'Kém' };
  } else {
    return { color: '💀', icon: '☠️', status: 'Hỏng nặng' };
  }
}
