import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import User from '../models/User.mjs';
import { formatCurrency } from './util.mjs';
import { infoEmbed, errorEmbed, successEmbed } from './util.mjs';
const SHOP = [
  { key:'bait', name:'Bait (mồi)', price:50, desc:'Tăng nhẹ tỉ lệ cá hiếm 1 lần câu (auto dùng).', minLevel:1 },
  { key:'lure', name:'Lure', price:250, desc:'+15 phút tăng tỉ lệ hiếm.', minLevel:2 },
  { key:'booster', name:'Booster', price:400, desc:'x2 giá bán trong 10 phút.', minLevel:3 },
  { key:'charm', name:'Charm', price:1200, desc:'Tăng nhẹ tỉ lệ hiếm 24h.', minLevel:5 },
  { key:'relic', name:'Relic', price:2400, desc:'Tăng mạnh tỉ lệ hiếm 24h.', minLevel:8 },
  { key:'luckycoin', name:'Lucky Coin', price:600, desc:'+25% giá bán trong 60 phút.', minLevel:4 },
  { key:'megabooster', name:'Mega Booster', price:900, desc:'x2.5 giá bán trong 5 phút.', minLevel:7 },
  { key:'doublehook', name:'Double Hook', price:700, desc:'30% cơ hội được 2 cá trong 10 phút.', minLevel:4 },
  { key:'vacuum', name:'Vacuum', price:300, desc:'Giảm 2 lần bấm khi câu trong 15 phút.', minLevel:1 },
  { key:'sonar', name:'Sonar', price:800, desc:'Đảm bảo tối thiểu độ hiếm Rare trong 10 phút.', minLevel:6 },
];
function itemByKey(k){ return SHOP.find(i=>i.key===k); }
export const data = new SlashCommandBuilder().setName('shop').setDescription('Cửa hàng')
  .addSubcommand(sc=>sc.setName('list').setDescription('Danh sách vật phẩm theo cấp cần'))
  .addSubcommand(sc=>sc.setName('info').setDescription('Chi tiết vật phẩm').addStringOption(o=>o.setName('item').setDescription('Mã').setRequired(true)))
  .addSubcommand(sc=>sc.setName('buy').setDescription('Mua').addStringOption(o=>o.setName('item').setDescription('Mã').setRequired(true)).addIntegerOption(o=>o.setName('quantity').setDescription('SL').setRequired(true)));
export async function execute(interaction){
  const sub = interaction.options.getSubcommand(); const userId = interaction.user.id; const guildId = interaction.guildId;
  let profile = await User.findOne({ userId, guildId }); if (!profile) profile = await User.create({ userId, guildId });
  if (sub==='list'){ const lvl = profile.rodLevel||1; const lines=[]; for(const it of SHOP){ if (lvl>=it.minLevel) lines.push(`• **${it.name}** (${it.key}) — ${formatCurrency(it.price)}💰\n   _${it.desc}_ (cần ≥ ${it.minLevel})`); } lines.push(`\nSố dư: **${formatCurrency(profile.coins)}💰** | Bait: **${profile.bait}🪱**`); await interaction.reply({ embeds:[infoEmbed("Cửa hàng", lines.join('\n'))] }); return; }
  const key = interaction.options.getString('item', true).toLowerCase(); const it = itemByKey(key); if (!it){ await interaction.reply({ ephemeral:true, embeds:[errorEmbed('Vật phẩm không tồn tại.')] }); return; }
  if (sub==='info'){ await interaction.reply({ embeds:[infoEmbed(it.name, `${it.desc}\nGiá: **${formatCurrency(it.price)}💰** | Yêu cầu cần ≥ **${it.minLevel}**`)] }); return; }
  if (sub==='buy'){ const qty = interaction.options.getInteger('quantity', true); if (qty<=0){ await interaction.reply({ ephemeral:true, embeds:[errorEmbed('Số lượng phải > 0')] }); return; } if ((profile.rodLevel||1) < it.minLevel){ await interaction.reply({ ephemeral:true, embeds:[errorEmbed(`Cần cấp cần tối thiểu ${it.minLevel}.`)] }); return; } const cost = it.price * qty; if (profile.coins < cost){ await interaction.reply({ ephemeral:true, embeds:[errorEmbed(`Không đủ tiền. Cần ${formatCurrency(cost)}💰, bạn còn thiếu ${formatCurrency(cost - profile.coins)}💰.`)] }); return; } profile.coins -= cost; if (key==='bait'){ profile.bait = (profile.bait||0) + qty; } else { const cur = profile.items?.get(key) || 0; profile.items.set(key, cur + qty); } await profile.save(); await interaction.reply({ embeds:[successEmbed(`Đã mua **${qty}× ${it.name}** với giá **${formatCurrency(cost)}💰**. Số dư: **${formatCurrency(profile.coins)}💰**`)] }); }
}
