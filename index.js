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