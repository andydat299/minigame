import { SlashCommandBuilder } from 'discord.js';
import User from '../models/User.mjs';
import { EFFECTS, activateEffect } from '../game/effects.mjs';
import { successEmbed, errorEmbed } from './util.mjs';
const USABLE = ['lure','booster','charm','relic','luckycoin','megabooster','doublehook','vacuum','sonar'];
export const data = new SlashCommandBuilder().setName('use').setDescription('Kích hoạt buff').addStringOption(o=>o.setName('item').setDescription('Vật phẩm').setRequired(true).addChoices(...USABLE.map(k=>({name:k,value:k}))));
export async function execute(interaction){
  const key = interaction.options.getString('item', true).toLowerCase(); const userId = interaction.user.id, guildId = interaction.guildId;
  let profile = await User.findOne({ userId, guildId }); if (!profile) profile = await User.create({ userId, guildId });
  const have = profile.items?.get(key)||0; if (have<=0){ await interaction.reply({ ephemeral:true, embeds:[errorEmbed('Bạn không có vật phẩm này.')] }); return; }
  profile.items.set(key, have-1); const minutes = EFFECTS[key]?.minutes || 10; activateEffect(profile, key, minutes); await profile.save();
  await interaction.reply({ embeds:[successEmbed(`Đã kích hoạt **${key}** trong **${minutes} phút**.`)] });
}
