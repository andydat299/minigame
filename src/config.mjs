import 'dotenv/config';
export const TOKEN = process.env.TOKEN;
export const CLIENT_ID = process.env.CLIENT_ID;
export const GUILD_ID = process.env.GUILD_ID || '';
export const MONGO_URI = process.env.MONGO_URI;
export const DEV_IDS = (process.env.DEV_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
export const FISH_COOLDOWN_SEC = 15;
export function isDev(userId) { return DEV_IDS.includes(userId); }
if (!TOKEN) throw new Error("Missing TOKEN in .env");
if (!MONGO_URI) throw new Error("Missing MONGO_URI in .env");
