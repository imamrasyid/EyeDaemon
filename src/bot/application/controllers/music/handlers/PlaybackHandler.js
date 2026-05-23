/**
 * PlaybackHandler
 * 
 * Handles music playback commands: play, pause, resume, skip, stop
 */

const { replyEphemeral } = require('../../../../system/helpers/InteractionHelper');

class PlaybackHandler {
    constructor(controller) {
        this.controller = controller;
    }

    /**
     * Play command handler
     * Handles playing music from URL or search query
     * @param {Object} interaction - Discord interaction
     */
    async play(interaction) {
        try {
            await interaction.deferReply();

            const query = interaction.options.getString('query', true);
            const member = interaction.member;
            const guild = interaction.guild;

            // Validate voice channel
            const voiceChannel = this.controller.validateVoiceChannel(member);
            this.controller.validateBotPermissions(voiceChannel, guild);

            // Use service to play track
            const result = await this.controller.musicPlayerService.play({
                guildId: guild.id,
                query: query,
                voiceChannel: voiceChannel,
                textChannel: interaction.channel,
                requester: interaction.user,
            });

            // Send response
            const embed = this.controller.createQueuedEmbed(result.track, result.position);
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            this.controller.log(`Error in play command: ${error.message}`, 'error');
            const errorMsg = error.message || 'Failed to play track';

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: `❌ ${errorMsg}` });
            } else {
                await replyEphemeral(interaction, `❌ ${errorMsg}`);
            }
        }
    }

    /**
     * Pause command handler
     * Pauses the current playback
     * @param {Object} interaction - Discord interaction
     */
    async pause(interaction) {
        try {
            const guildId = interaction.guild.id;

            // Check if something is playing
            if (!this.controller.musicPlayerService.isPlaying(guildId)) {
                await replyEphemeral(interaction, '❌ Nothing is currently playing');
                return;
            }

            // Pause playback
            const success = this.controller.musicPlayerService.pause(guildId);

            if (success) {
                await interaction.reply('⏸️ Paused playback');
                this.controller.log(`Paused playback in guild ${guildId}`, 'info');
            } else {
                await replyEphemeral(interaction, '❌ Failed to pause playback');
            }
        } catch (error) {
            this.controller.log(`Error in pause command: ${error.message}`, 'error');
            await this.controller.sendError(interaction, 'Failed to pause playback');
        }
    }

    /**
     * Resume command handler
     * Resumes paused playback
     * @param {Object} interaction - Discord interaction
     */
    async resume(interaction) {
        try {
            const guildId = interaction.guild.id;

            // Check if something is paused
            if (!this.controller.musicPlayerService.isPaused(guildId)) {
                await replyEphemeral(interaction, '❌ Nothing is currently paused');
                return;
            }

            // Resume playback
            const success = this.controller.musicPlayerService.resume(guildId);

            if (success) {
                await interaction.reply('▶️ Resumed playback');
                this.controller.log(`Resumed playback in guild ${guildId}`, 'info');
            } else {
                await replyEphemeral(interaction, '❌ Failed to resume playback');
            }
        } catch (error) {
            this.controller.log(`Error in resume command: ${error.message}`, 'error');
            await this.controller.sendError(interaction, 'Failed to resume playback');
        }
    }

    /**
     * Skip command handler
     * Skips the current track
     * @param {Object} interaction - Discord interaction
     */
    async skip(interaction) {
        try {
            const guildId = interaction.guild.id;

            // Check DJ permissions
            const hasDJ = await this.controller.hasDJPermissions(interaction.member, guildId);
            if (!hasDJ) {
                await replyEphemeral(interaction, '❌ You need the DJ role to use this command');
                return;
            }

            // Check if something is playing
            const current = this.controller.musicPlayerService.getCurrent(guildId);
            if (!current) {
                await replyEphemeral(interaction, '❌ Nothing is currently playing');
                return;
            }

            // Skip track
            this.controller.musicPlayerService.skip(guildId);

            await interaction.reply(`⏭️ Skipped **${current.title}**`);
            this.controller.log(`Skipped track in guild ${guildId}`, 'info');
        } catch (error) {
            this.controller.log(`Error in skip command: ${error.message}`, 'error');
            await this.controller.sendError(interaction, 'Failed to skip track');
        }
    }

    /**
     * Stop command handler
     * Stops playback and clears queue
     * @param {Object} interaction - Discord interaction
     */
    async stop(interaction) {
        try {
            const guildId = interaction.guild.id;

            // Check DJ permissions
            const hasDJ = await this.controller.hasDJPermissions(interaction.member, guildId);
            if (!hasDJ) {
                await replyEphemeral(interaction, '❌ You need the DJ role to use this command');
                return;
            }

            // Check if bot is connected
            if (!this.controller.musicPlayerService.isConnected(guildId)) {
                await replyEphemeral(interaction, '❌ I am not in a voice channel');
                return;
            }

            // Stop playback
            await this.controller.musicPlayerService.stop(guildId);

            await interaction.reply('⏹️ Stopped playback and left voice channel');
            this.controller.log(`Stopped playback in guild ${guildId}`, 'info');
        } catch (error) {
            this.controller.log(`Error in stop command: ${error.message}`, 'error');
            await this.controller.sendError(interaction, 'Failed to stop playback');
        }
    }
}

module.exports = PlaybackHandler;
