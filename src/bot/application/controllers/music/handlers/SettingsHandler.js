/**
 * SettingsHandler
 * 
 * Handles music settings commands: volume, loop, filter, seek
 */

const { replyEphemeral } = require('../../../../system/helpers/InteractionHelper');

class SettingsHandler {
    constructor(controller) {
        this.controller = controller;
    }

    /**
     * Volume command handler
     * Sets the playback volume
     * @param {Object} interaction - Discord interaction
     */
    async volume(interaction) {
        try {
            const guildId = interaction.guild.id;
            const level = interaction.options.getInteger('level', true);

            // Check DJ permissions
            const hasDJ = await this.controller.hasDJPermissions(interaction.member, guildId);
            if (!hasDJ) {
                await replyEphemeral(interaction, '❌ You need the DJ role to use this command');
                return;
            }

            // Check if bot is playing
            if (!this.controller.musicPlayerService.isConnected(guildId)) {
                await replyEphemeral(interaction, '❌ I am not in a voice channel');
                return;
            }

            // Set volume using service
            await this.controller.musicPlayerService.setVolume(guildId, level);

            await interaction.reply(`🔊 Volume set to **${level}%**`);
            this.controller.log(`Set volume to ${level}% in guild ${guildId}`, 'info');
        } catch (error) {
            this.controller.log(`Error in volume command: ${error.message}`, 'error');
            await this.controller.sendError(interaction, 'Failed to set volume');
        }
    }

    /**
     * Loop command handler
     * Sets the loop mode
     * @param {Object} interaction - Discord interaction
     */
    async loop(interaction) {
        try {
            const guildId = interaction.guild.id;
            const mode = interaction.options.getString('mode', true);

            // Check DJ permissions
            const hasDJ = await this.controller.hasDJPermissions(interaction.member, guildId);
            if (!hasDJ) {
                await replyEphemeral(interaction, '❌ You need the DJ role to use this command');
                return;
            }

            // Check if bot is playing
            if (!this.controller.musicPlayerService.isConnected(guildId)) {
                await replyEphemeral(interaction, '❌ I am not in a voice channel');
                return;
            }

            // Set loop mode using service
            await this.controller.musicPlayerService.setLoop(guildId, mode);

            const loopEmoji = {
                'off': '➡️',
                'track': '🔂',
                'queue': '🔁'
            };

            await interaction.reply(`${loopEmoji[mode]} Loop mode set to **${mode}**`);
            this.controller.log(`Set loop mode to ${mode} in guild ${guildId}`, 'info');
        } catch (error) {
            this.controller.log(`Error in loop command: ${error.message}`, 'error');
            await this.controller.sendError(interaction, 'Failed to set loop mode');
        }
    }

    /**
     * Filter command handler
     * Applies audio filters to playback
     * @param {Object} interaction - Discord interaction
     */
    async filter(interaction) {
        try {
            await interaction.deferReply();

            const guildId = interaction.guild.id;
            const filterType = interaction.options.getString('type', true);

            // Check DJ permissions
            const hasDJ = await this.controller.hasDJPermissions(interaction.member, guildId);
            if (!hasDJ) {
                await interaction.editReply({ content: '❌ You need the DJ role to use this command' });
                return;
            }

            // Check if bot is connected
            if (!this.controller.musicPlayerService.isConnected(guildId)) {
                await interaction.editReply({ content: '❌ I am not in a voice channel' });
                return;
            }

            // Set filter using service
            const success = await this.controller.musicPlayerService.setFilter(guildId, filterType);

            if (!success) {
                await interaction.editReply({ content: '❌ Invalid filter type' });
                return;
            }

            const filterEmoji = {
                'none': '🎵',
                'bassboost': '🔊',
                'nightcore': '⚡',
                'vaporwave': '🌊',
                '8d': '🎧',
                'karaoke': '🎤'
            };

            const filterName = filterType === 'none' ? 'No filter' : filterType.charAt(0).toUpperCase() + filterType.slice(1);
            await interaction.editReply(`${filterEmoji[filterType]} Applied **${filterName}** filter`);
            this.controller.log(`Applied ${filterType} filter in guild ${guildId}`, 'info');
        } catch (error) {
            this.controller.log(`Error in filter command: ${error.message}`, 'error');

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: '❌ Failed to apply filter' });
            } else {
                await this.controller.sendError(interaction, 'Failed to apply filter');
            }
        }
    }

    /**
     * Seek command handler
     * Seeks to a specific time in the current track
     * @param {Object} interaction - Discord interaction
     */
    async seek(interaction) {
        try {
            await interaction.deferReply();

            const guildId = interaction.guild.id;
            const timeStr = interaction.options.getString('time', true);

            // Check DJ permissions
            const hasDJ = await this.controller.hasDJPermissions(interaction.member, guildId);
            if (!hasDJ) {
                await interaction.editReply({ content: '❌ You need the DJ role to use this command' });
                return;
            }

            // Check if something is playing
            const current = this.controller.musicPlayerService.getCurrent(guildId);
            if (!current) {
                await interaction.editReply({ content: '❌ Nothing is currently playing' });
                return;
            }

            // Parse time (MM:SS or seconds)
            let seconds;
            if (timeStr.includes(':')) {
                const parts = timeStr.split(':');
                seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
            } else {
                seconds = parseInt(timeStr);
            }

            if (isNaN(seconds) || seconds < 0) {
                await interaction.editReply({ content: '❌ Invalid time format. Use MM:SS or seconds' });
                return;
            }

            // current.duration is in milliseconds, convert seconds to ms for comparison
            if (seconds * 1000 > current.duration) {
                await interaction.editReply({ content: `❌ Time exceeds track duration (${this.controller.formatDuration(current.duration)})` });
                return;
            }

            // Seek using service
            await this.controller.musicPlayerService.seek(guildId, seconds);

            await interaction.editReply(`⏩ Seeked to **${this.controller.formatDuration(seconds)}** in **${current.title}**`);
            this.controller.log(`Seeked to ${seconds}s in guild ${guildId}`, 'info');
        } catch (error) {
            this.controller.log(`Error in seek command: ${error.message}`, 'error');

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: `❌ ${error.message || 'Failed to seek'}` });
            } else {
                await this.controller.sendError(interaction, error.message || 'Failed to seek');
            }
        }
    }
}

module.exports = SettingsHandler;
