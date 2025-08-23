import { Client, GatewayIntentBits, Collection } from 'discord.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

// Load commands with error handling
const commandModules = [
  { path: './commands/fish.mjs', name: 'fish' },
  { path: './commands/profile.mjs', name: 'profile' },
  { path: './commands/daily.mjs', name: 'daily' },
  { path: './commands/sellall.mjs', name: 'sellall' },
  { path: './commands/inventory.mjs', name: 'inventory' },
  { path: './commands/quest.mjs', name: 'quest' },
  { path: './commands/loan.mjs', name: 'loan' },
  { path: './commands/credit.mjs', name: 'credit' },
  { path: './commands/casino.mjs', name: 'casino' },
  { path: './commands/repair.mjs', name: 'repair' },
  { path: './commands/upgrade.mjs', name: 'upgrade' },
  { path: './commands/shop.mjs', name: 'shop' },
  { path: './commands/achievements.mjs', name: 'achievements' },
  { path: './commands/auction.mjs', name: 'auction' }
];

console.log('🔄 Loading commands...');
for (const { path, name } of commandModules) {
  try {
    const command = await import(path);
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
      console.log(`✅ ${name} loaded successfully`);
    } else {
      console.log(`⚠️ ${name} missing data or execute function`);
    }
  } catch (error) {
    console.log(`❌ Failed to load ${name}: ${error.message}`);
  }
}

// Connect to MongoDB
try {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');
} catch (error) {
  console.error('❌ MongoDB connection failed:', error);
  process.exit(1);
}

// Bot ready event
client.once('ready', () => {
  console.log(`🤖 Bot ${client.user.tag} is online!`);
  console.log(`📊 Loaded ${client.commands.size} commands`);
});

// Command handler
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.log(`❓ Unknown command: ${interaction.commandName}`);
    return interaction.reply({ 
      content: 'Lệnh không tồn tại!', 
      ephemeral: true 
    });
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`💥 Command error (${interaction.commandName}):`, error);
    const reply = { 
      content: 'Có lỗi xảy ra khi thực hiện lệnh!', 
      ephemeral: true 
    };
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

// Error handling
client.on('error', error => {
  console.error('❌ Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('❌ Unhandled promise rejection:', error);
});

// Login
client.login(process.env.BOT_TOKEN);