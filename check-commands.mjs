// Command checker script
import fs from 'fs/promises';

const commandFiles = [
  'fish.mjs', 'inventory.mjs', 'sellall.mjs', 'profile.mjs', 'upgrade.mjs',
  'leaderboard.mjs', 'addcash.mjs', 'shop.mjs', 'give.mjs', 'stats.mjs',
  'use.mjs', 'effects.mjs', 'boss.mjs', 'fishingevent.mjs', 'ban.mjs',
  'repair.mjs', 'daily.mjs', 'casino.mjs', 'achievements.mjs', 'auction.mjs',
  'quest.mjs', 'loan.mjs', 'credit.mjs'
];

console.log('🔍 Checking all command files...\n');

for (const file of commandFiles) {
  try {
    const command = await import(`./src/commands/${file}`);
    if (command.data && command.execute) {
      console.log(`✅ ${file} - OK (${command.data.name})`);
    } else {
      console.log(`❌ ${file} - Missing data or execute`);
      if (!command.data) console.log(`   - Missing data export`);
      if (!command.execute) console.log(`   - Missing execute export`);
    }
  } catch (error) {
    console.log(`💥 ${file} - ERROR: ${error.message}`);
  }
}

console.log('\n✅ Check complete!');