// Danh sách cá Việt Nam (~30 loài) + Vảy rồng (Boss)
export const FISH = [
  // Common (8)
  { name: "Cá rô phi", rarity: "common", price: 5 },
  { name: "Cá cơm", rarity: "common", price: 6 },
  { name: "Cá trê nhỏ", rarity: "common", price: 7 },
  { name: "Cá lóc nhỏ", rarity: "common", price: 8 },
  { name: "Cá lòng tong", rarity: "common", price: 5 },
  { name: "Cá rô đồng", rarity: "common", price: 9 },
  { name: "Cá mè", rarity: "common", price: 10 },
  { name: "Cá sặc", rarity: "common", price: 12 },

  // Uncommon (6)
  { name: "Cá chép", rarity: "uncommon", price: 20 },
  { name: "Cá trắm", rarity: "uncommon", price: 25 },
  { name: "Cá basa", rarity: "uncommon", price: 30 },
  { name: "Cá bống", rarity: "uncommon", price: 22 },
  { name: "Cá trê vàng", rarity: "uncommon", price: 28 },
  { name: "Cá đối", rarity: "uncommon", price: 35 },

  // Rare (6)
  { name: "Cá lăng", rarity: "rare", price: 80 },
  { name: "Cá chim trắng", rarity: "rare", price: 100 },
  { name: "Cá dìa", rarity: "rare", price: 120 },
  { name: "Cá chình", rarity: "rare", price: 130 },
  { name: "Cá hường", rarity: "rare", price: 110 },
  { name: "Cá bơn", rarity: "rare", price: 140 },

  // Epic (4)
  { name: "Cá thu", rarity: "epic", price: 200 },
  { name: "Cá ngừ", rarity: "epic", price: 240 },
  { name: "Cá mú", rarity: "epic", price: 280 },
  { name: "Cá hố", rarity: "epic", price: 300 },

  // Legendary (4)
  { name: "Cá mập", rarity: "legendary", price: 600 },
  { name: "Cá heo", rarity: "legendary", price: 800 },
  { name: "Cá voi xanh", rarity: "legendary", price: 1000 },
  { name: "Rùa biển lớn", rarity: "legendary", price: 1200 },

  // Mythic (2)
  { name: "Cá kình khổng lồ", rarity: "mythic", price: 1800 },
  { name: "Long ngư", rarity: "mythic", price: 2500 },

  // Boss drop (để /sellall có giá)
  { name: "Vảy rồng", rarity: "boss", price: 600 },
];

export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];

const BASE_WEIGHTS = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 0.9,
  mythic: 0.1,
};

export function rarityWeightsForRod(rodLevel) {
  const l = Math.max(1, Math.min(10, rodLevel));
  const bonus = (l - 1);
  const w = { ...BASE_WEIGHTS };
  const c_to_u = bonus * 2.2; w.common = Math.max(5, w.common - c_to_u); w.uncommon += c_to_u * 0.65;
  const u_to_r = bonus * 1.4; w.uncommon = Math.max(5, w.uncommon - u_to_r); w.rare += u_to_r * 0.7;
  const r_to_e = bonus * 0.8; w.rare = Math.max(4, w.rare - r_to_e); w.epic += r_to_e * 0.75;
  const e_to_l = bonus * 0.35; w.epic = Math.max(2, w.epic - e_to_l); w.legendary += e_to_l * 0.8;
  const l_to_m = bonus * 0.08; w.legendary = Math.max(0.2, w.legendary - l_to_m); w.mythic += l_to_m;
  return w;
}

export function pickRarity(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((a,[,v])=>a+v,0);
  let r = Math.random() * total;
  for (const [rar, w] of entries) { if (r < w) return rar; r -= w; }
  return "common";
}

export function pickFishByRarity(rarity) {
  const pool = FISH.filter(f => f.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function upgradeCost(level) {
  const next = level + 1; if (next > 10) return Infinity;
  return Math.floor(100 * Math.pow(next, 1.6));
}

export function boostWeightsLight(weights) {
  const w = { ...weights };
  const c_to_u = 2.0; w.common = Math.max(3, w.common - c_to_u); w.uncommon += c_to_u * 0.6;
  const u_to_r = 1.2; w.uncommon = Math.max(4, w.uncommon - u_to_r); w.rare += u_to_r * 0.7;
  const r_to_e = 0.6; w.rare = Math.max(2, w.rare - r_to_e); w.epic += r_to_e * 0.8;
  w.legendary += 0.15; w.mythic += 0.05; return w;
}

export function boostWeightsStrong(weights) {
  const w = { ...weights };
  const c_to_u = 3.5; w.common = Math.max(2, w.common - c_to_u); w.uncommon += c_to_u * 0.6;
  const u_to_r = 2.0; w.uncommon = Math.max(3, w.uncommon - u_to_r); w.rare += u_to_r * 0.7;
  const r_to_e = 1.0; w.rare = Math.max(1.5, w.rare - r_to_e); w.epic += r_to_e * 0.8;
  w.legendary += 0.35; w.mythic += 0.12; return w;
}

export function enforceMinRarity(weights, minRarity) {
  const order = RARITIES; const minIdx = order.indexOf(minRarity);
  const w = { ...weights };
  for (let i = 0; i < minIdx; i++) w[order[i]] = 0.0001;
  return w;
}
