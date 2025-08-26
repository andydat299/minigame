import { REST, Routes } from 'discord.js';
import { CLIENT_ID, GUILD_ID, TOKEN } from './config.mjs';
import * as fish from './commands/fish.mjs';
import * as inventory from './commands/inventory.mjs';
import * as sellall from './commands/sellall.mjs';
import * as profile from './commands/profile.mjs';
import * as upgrade from './commands/upgrade.mjs';
import * as leaderboard from './commands/leaderboard.mjs';
import * as addcash from './commands/addcash.mjs';
import * as shop from './commands/shop.mjs';
import * as give from './commands/give.mjs';
import * as stats from './commands/stats.mjs';
import * as use from './commands/use.mjs';
import * as effects from './commands/effects.mjs';
import * as boss from './commands/boss.mjs';
import * as fishingevent from './commands/fishingevent.mjs';
import * as ban from './commands/ban.mjs';
import * as repair from './commands/repair.mjs';
import * as daily from './commands/daily.mjs';
import * as casino from './commands/casino.mjs';
import * as achievements from './commands/achievements.mjs';
import * as auction from './commands/auction.mjs';
import * as quest from './commands/quest.mjs';
import * as loan from './commands/loan.mjs';
import * as credit from './commands/credit.mjs';
import * as relationship from './commands/relationship.mjs';
import * as blackjack from './commands/blackjack.mjs';
import * as theme from './commands/theme.mjs';
import * as taixiu from './commands/taixiu.mjs';
import * as jackpot from './commands/jackpot.mjs';
import * as antiraid from './commands/antiraid.mjs';
import * as globalbalance from './commands/globalbalance.mjs';
import * as migrate from './commands/migrate.mjs';
import * as loanrepay from './commands/loanrepay.mjs';

const commands = [
  fish, 
  inventory, 
  sellall, 
  profile, 
  upgrade, 
  leaderboard, 
  addcash, 
  shop, 
  give, 
  stats, 
  use, 
  effects, 
  boss, 
  fishingevent, 
  ban, 
  repair, 
  daily, 
  casino, 
  achievements, 
  auction, 
  quest, 
  loan, 
  credit,
  relationship,
  blackjack,
  theme,
  taixiu,
  jackpot,
  antiraid,
  globalbalance,
  migrate,
  loanrepay
].map(m => m.data.toJSON());
const rest = new REST({ version: '10' }).setToken(TOKEN);
try {
  if (GUILD_ID) {
    console.log(`[deploy] Guild ${GUILD_ID}...`);
    const data = await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log(`[deploy] Done ${Array.isArray(data)?data.length:0} commands.`);
  } else {
    console.log(`[deploy] GLOBAL...`);
    const data = await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log(`[deploy] Done ${Array.isArray(data)?data.length:0} commands.`);
  }
} catch (e) { console.error(e); process.exit(1); }
