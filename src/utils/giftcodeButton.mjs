// Add quick giftcode redeem to daily command
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// Add this to the daily command result
export function addGiftcodeButton() {
    const giftcodeButton = new ButtonBuilder()
        .setCustomId('quick_giftcode')
        .setLabel('🎁 Nhập Giftcode')
        .setStyle(ButtonStyle.Secondary);
    
    return new ActionRowBuilder().addComponents(giftcodeButton);
}