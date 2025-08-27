const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const Database = require('./database/database');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Initialize collections
client.commands = new Collection();
client.slashCommands = new Collection();
client.games = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.name, command);
}

// Load slash commands
const slashCommandsPath = path.join(__dirname, 'slash-commands');
if (fs.existsSync(slashCommandsPath)) {
    const slashCommandFiles = fs.readdirSync(slashCommandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of slashCommandFiles) {
        const filePath = path.join(slashCommandsPath, file);
        const command = require(filePath);
        client.slashCommands.set(command.data.name, command);
    }
}

// Load games
const gamesPath = path.join(__dirname, 'games');
if (fs.existsSync(gamesPath)) {
    const gameFiles = fs.readdirSync(gamesPath).filter(file => file.endsWith('.js'));
    
    for (const file of gameFiles) {
        const filePath = path.join(gamesPath, file);
        const game = require(filePath);
        client.games.set(game.name, game);
    }
}

// Initialize database
Database.init();

client.once('ready', async () => {
    console.log(`✅ Bot đã online! Đăng nhập như ${client.user.tag}`);
    console.log(`🎮 Đã load ${client.commands.size} lệnh prefix`);
    console.log(`⚡ Đã load ${client.slashCommands.size} slash commands`);
    console.log(`🎯 Đã load ${client.games.size} minigame`);
    
    // Deploy slash commands
    await deploySlashCommands();
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const prefix = '!';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
        await command.execute(message, args, client);
    } catch (error) {
        console.error(error);
        message.reply('❌ Có lỗi xảy ra khi thực hiện lệnh!');
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const command = client.slashCommands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            const errorMessage = '❌ Có lỗi xảy ra khi thực hiện lệnh!';
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    } else if (interaction.isButton()) {
        // Xử lý button interactions
        try {
            // Sicbo buttons
            const sicboCommand = client.slashCommands.get('sicbo-new');
            if (sicboCommand && sicboCommand.handleButtonInteraction) {
                const handled = await sicboCommand.handleButtonInteraction(interaction);
                if (handled !== false) return;
            }

            // Mining buttons
            if (interaction.customId === 'mine_hit') {
                const miningCommand = client.slashCommands.get('mining');
                if (miningCommand) {
                    // Mining button được handle trong collector của mining command
                    return;
                }
            }

            // Adventure buttons
            if (interaction.customId.startsWith('boss_')) {
                const adventureCommand = client.slashCommands.get('adventure');
                if (adventureCommand) {
                    // Adventure button được handle trong collector của adventure command
                    return;
                }
            }

        } catch (error) {
            console.error('Button interaction error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Có lỗi xảy ra khi xử lý button!', ephemeral: true });
            }
        }
    } else if (interaction.isModalSubmit()) {
        // Xử lý modal submissions
        try {
            // Sicbo modal
            const sicboCommand = client.slashCommands.get('sicbo-new');
            if (sicboCommand && sicboCommand.handleModalSubmit) {
                const handled = await sicboCommand.handleModalSubmit(interaction);
                if (handled !== false) return;
            }

        } catch (error) {
            console.error('Modal interaction error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Có lỗi xảy ra khi xử lý modal!', ephemeral: true });
            }
        }
    }
});
    }
});

// Login
client.login('YOUR_BOT_TOKEN'); // Thay thế bằng token bot của bạn

// Deploy slash commands function
async function deploySlashCommands() {
    const commands = [];
    
    client.slashCommands.forEach(command => {
        commands.push(command.data.toJSON());
    });

    if (commands.length === 0) return;

    const rest = new REST({ version: '10' }).setToken('YOUR_BOT_TOKEN'); // Thay thế bằng token

    try {
        console.log('🔄 Đang deploy slash commands...');
        
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );

        console.log('✅ Đã deploy slash commands thành công!');
    } catch (error) {
        console.error('❌ Lỗi deploy slash commands:', error);
    }
}