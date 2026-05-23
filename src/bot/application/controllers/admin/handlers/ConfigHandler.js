/**
 * ConfigHandler
 * 
 * Handles guild configuration commands: view, set, reset, list
 */

const { EmbedBuilder } = require('discord.js');
const { replyEphemeral } = require('../../../../system/helpers/InteractionHelper');

class ConfigHandler {
    constructor(controller) {
        this.controller = controller;
    }

    /**
     * Config command handler
     * Manages guild configuration settings
     * @param {Object} interaction - Discord interaction
     */
    async config(interaction) {
        try {
            // Check if user has Administrator permission
            if (!interaction.member.permissions.has('Administrator')) {
                return await replyEphemeral(interaction, '❌ You need Administrator permission to use this command.');
            }

            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'view':
                    await this.configView(interaction);
                    break;
                case 'set':
                    await this.configSet(interaction);
                    break;
                case 'reset':
                    await this.configReset(interaction);
                    break;
                case 'list':
                    await this.configList(interaction);
                    break;
                default:
                    await replyEphemeral(interaction, '❌ Unknown subcommand');
            }
        } catch (error) {
            this.controller.log(`Error in config command: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.controller.safeReplyError(interaction, 'Failed to manage configuration');
        }
    }

    /**
     * View guild configuration (config view subcommand)
     * @param {Object} interaction - Discord interaction
     */
    async configView(interaction) {
        try {
            await interaction.deferReply();

            const guildId = interaction.guild.id;

            if (!this.controller.guildConfigService) {
                return await interaction.editReply({
                    content: '❌ GuildConfigService is not available.',
                });
            }

            // Fetch all settings for the guild
            const config = await this.controller.guildConfigService.getGuildConfig(guildId);

            // Create embed with organized categories
            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('⚙️ Guild Configuration')
                .setDescription(`Current configuration for **${interaction.guild.name}**\n\nUse \`/config set\` to change settings or \`/config list\` to see all available settings.`)
                .setTimestamp();

            // General settings
            embed.addFields({
                name: '📋 General',
                value: `**Prefix:** \`${config.prefix}\``,
                inline: false,
            });

            // Music settings
            const musicValue = [
                `**DJ Role:** ${config.dj_role ? `<@&${config.dj_role}>` : 'Not set'}`,
                `**Default Volume:** ${config.volume_default}%`,
                `**Max Queue Size:** ${config.max_queue_size} tracks`,
            ].join('\n');

            embed.addFields({
                name: '🎵 Music',
                value: musicValue,
                inline: false,
            });

            // Welcome & Goodbye settings
            const welcomeGoodbyeValue = [
                `**Welcome Enabled:** ${config.welcome_enabled ? '✅ Yes' : '❌ No'}`,
                `**Welcome Channel:** ${config.welcome_channel ? `<#${config.welcome_channel}>` : 'Not set'}`,
                `**Welcome Message:** ${config.welcome_message ? `\`${config.welcome_message.substring(0, 40)}${config.welcome_message.length > 40 ? '...' : ''}\`` : 'Not set'}`,
                `**Auto Role:** ${config.auto_role ? `<@&${config.auto_role}>` : 'Not set'}`,
                ``,
                `**Goodbye Enabled:** ${config.goodbye_enabled ? '✅ Yes' : '❌ No'}`,
                `**Goodbye Channel:** ${config.goodbye_channel ? `<#${config.goodbye_channel}>` : 'Not set'}`,
                `**Goodbye Message:** ${config.goodbye_message ? `\`${config.goodbye_message.substring(0, 40)}${config.goodbye_message.length > 40 ? '...' : ''}\`` : 'Not set'}`,
            ].join('\n');

            embed.addFields({
                name: '👋 Welcome & Goodbye System',
                value: welcomeGoodbyeValue,
                inline: false,
            });

            // Moderation settings
            const moderationValue = [
                `**Log Channel:** ${config.moderation_log_channel ? `<#${config.moderation_log_channel}>` : 'Not set'}`,
            ].join('\n');

            embed.addFields({
                name: '🛡️ Moderation',
                value: moderationValue,
                inline: false,
            });

            // Leveling settings
            const levelingValue = [
                `**XP Multiplier:** ${config.leveling_xp_multiplier}x`,
            ].join('\n');

            embed.addFields({
                name: '📈 Leveling',
                value: levelingValue,
                inline: false,
            });

            // Economy settings
            const economyValue = [
                `**Starting Balance:** ${config.economy_starting_balance} coins`,
            ].join('\n');

            embed.addFields({
                name: '💰 Economy',
                value: economyValue,
                inline: false,
            });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            this.controller.log(`Error in configView: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.controller.safeReplyError(interaction, 'Failed to fetch configuration');
        }
    }

    /**
     * Set guild configuration (config set subcommand)
     * @param {Object} interaction - Discord interaction
     */
    async configSet(interaction) {
        try {
            await interaction.deferReply();

            const guildId = interaction.guild.id;
            const setting = interaction.options.getString('setting');
            const value = interaction.options.getString('value');

            if (!this.controller.guildConfigService) {
                return await interaction.editReply({
                    content: '❌ GuildConfigService is not available.',
                });
            }

            // Validate setting exists
            const availableSettings = this.controller.guildConfigService.listAvailableSettings();
            const allSettings = Object.values(availableSettings).flat();
            const settingExists = allSettings.some(s => s.key === setting);

            if (!settingExists) {
                return await interaction.editReply({
                    content: `❌ Unknown setting: \`${setting}\`\n\nUse \`/config list\` to see all available settings.`,
                });
            }

            // Set the setting
            await this.controller.guildConfigService.setSetting(guildId, setting, value);

            // Get the new value to display
            const newValue = await this.controller.guildConfigService.getSetting(guildId, setting);

            // Format the value for display
            let displayValue = newValue;
            if (setting.includes('role') && newValue) {
                displayValue = `<@&${newValue}>`;
            } else if (setting.includes('channel') && newValue) {
                displayValue = `<#${newValue}>`;
            } else if (typeof newValue === 'boolean') {
                displayValue = newValue ? '✅ Enabled' : '❌ Disabled';
            } else if (newValue === null) {
                displayValue = 'Not set';
            } else {
                displayValue = `\`${newValue}\``;
            }

            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('✅ Configuration Updated')
                .setDescription(`Successfully updated **${setting}**`)
                .addFields({
                    name: 'New Value',
                    value: displayValue,
                    inline: false,
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            this.controller.log(`Error in configSet: ${error.message}`, 'error', {
                stack: error.stack,
                setting: interaction.options.getString('setting'),
                value: interaction.options.getString('value')
            });

            // Check if we can still reply
            try {
                if (interaction.deferred && !interaction.replied) {
                    await interaction.editReply({
                        content: `❌ Failed to set configuration: ${error.message}`,
                    });
                } else if (!interaction.replied) {
                    await interaction.reply({
                        content: `❌ Failed to set configuration: ${error.message}`,
                        flags: 64 // MessageFlags.Ephemeral
                    });
                }
            } catch (replyError) {
                this.controller.log(`Failed to send error message: ${replyError.message}`, 'error');
            }
        }
    }

    /**
     * Reset guild configuration (config reset subcommand)
     * @param {Object} interaction - Discord interaction
     */
    async configReset(interaction) {
        try {
            await interaction.deferReply();

            const guildId = interaction.guild.id;
            const setting = interaction.options.getString('setting');

            if (!this.controller.guildConfigService) {
                return await interaction.editReply({
                    content: '❌ GuildConfigService is not available.',
                });
            }

            // Validate setting exists
            const availableSettings = this.controller.guildConfigService.listAvailableSettings();
            const allSettings = Object.values(availableSettings).flat();
            const settingMetadata = allSettings.find(s => s.key === setting);

            if (!settingMetadata) {
                return await interaction.editReply({
                    content: `❌ Unknown setting: \`${setting}\`\n\nUse \`/config list\` to see all available settings.`,
                });
            }

            // Reset the setting
            try {
                await this.controller.guildConfigService.resetSetting(guildId, setting);

                // Format the default value for display
                let displayValue = settingMetadata.default;
                if (setting.includes('role') && displayValue) {
                    displayValue = `<@&${displayValue}>`;
                } else if (setting.includes('channel') && displayValue) {
                    displayValue = `<#${displayValue}>`;
                } else if (typeof displayValue === 'boolean') {
                    displayValue = displayValue ? '✅ Enabled' : '❌ Disabled';
                } else if (displayValue === null) {
                    displayValue = 'Not set';
                } else {
                    displayValue = `\`${displayValue}\``;
                }

                const embed = new EmbedBuilder()
                    .setColor(0xe67e22)
                    .setTitle('🔄 Configuration Reset')
                    .setDescription(`Successfully reset **${setting}** to default value`)
                    .addFields({
                        name: 'Default Value',
                        value: displayValue,
                        inline: false,
                    })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                this.controller.log(`Error resetting config: ${error.message}`, 'error');
                return await interaction.editReply({
                    content: `❌ Failed to reset configuration: ${error.message}`,
                });
            }
        } catch (error) {
            this.controller.log(`Error in configReset: ${error.message}`, 'error', {
                stack: error.stack
            });
            await this.controller.safeReplyError(interaction, 'Failed to reset configuration');
        }
    }

    /**
     * List all available settings (config list subcommand)
     * @param {Object} interaction - Discord interaction
     */
    async configList(interaction) {
        try {
            await interaction.deferReply();

            if (!this.controller.guildConfigService) {
                return await interaction.editReply({
                    content: '❌ GuildConfigService is not available.',
                });
            }

            // Get all available settings grouped by category
            const settingsByCategory = this.controller.guildConfigService.listAvailableSettings();

            // Create embed
            const embed = new EmbedBuilder()
                .setColor(0x9b59b6)
                .setTitle('📋 Available Settings')
                .setDescription('Use `/config set <setting> <value>` to change a setting\nUse `/config reset <setting>` to reset to default')
                .setTimestamp();

            // Category display names
            const categoryNames = {
                general: '📋 General',
                music: '🎵 Music',
                welcome: '👋 Welcome System',
                moderation: '🛡️ Moderation',
                leveling: '📈 Leveling',
                economy: '💰 Economy',
            };

            // Add fields for each category with character limit check
            for (const [category, settings] of Object.entries(settingsByCategory)) {
                const categoryName = categoryNames[category] || category;

                // Create shorter format to avoid embed limits
                const settingsText = settings.map(setting => {
                    let defaultValue = setting.default;
                    if (defaultValue === null) {
                        defaultValue = 'Not set';
                    } else if (typeof defaultValue === 'boolean') {
                        defaultValue = defaultValue ? '✅' : '❌';
                    } else if (String(defaultValue).length > 20) {
                        defaultValue = String(defaultValue).substring(0, 17) + '...';
                    }

                    // Shorter format
                    return `\`${setting.key}\` - ${setting.description.substring(0, 50)}${setting.description.length > 50 ? '...' : ''}`;
                }).join('\n');

                // Check if adding this field would exceed limits
                if (settingsText.length > 1024) {
                    // Split into multiple fields if too long
                    const chunks = [];
                    const lines = settingsText.split('\n');
                    let currentChunk = '';

                    for (const line of lines) {
                        if ((currentChunk + line + '\n').length > 1024) {
                            chunks.push(currentChunk);
                            currentChunk = line + '\n';
                        } else {
                            currentChunk += line + '\n';
                        }
                    }
                    if (currentChunk) chunks.push(currentChunk);

                    // Add chunks as separate fields
                    chunks.forEach((chunk, index) => {
                        embed.addFields({
                            name: index === 0 ? categoryName : `${categoryName} (cont.)`,
                            value: chunk,
                            inline: false,
                        });
                    });
                } else {
                    embed.addFields({
                        name: categoryName,
                        value: settingsText || 'No settings',
                        inline: false,
                    });
                }
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            this.controller.log(`Error in configList: ${error.message}`, 'error', {
                stack: error.stack,
                errorName: error.name
            });
            await this.controller.safeReplyError(interaction, `Failed to list settings: ${error.message}`);
        }
    }
}

module.exports = ConfigHandler;
