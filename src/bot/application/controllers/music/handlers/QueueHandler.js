/**
 * QueueHandler
 * 
 * Handles queue management commands: queue, nowplaying, shuffle, clear, remove, jump, move
 */

const { replyEphemeral } = require('../../../../system/helpers/InteractionHelper');

class QueueHandler {
    constructor(controller) {
        this.controller = controller;
    }

    /**
     * Queue command handler
     * Displays the current queue
     * @param {Object} interaction - Discord interaction
     */
    async queue(interaction) {
        try {
            const guildId = interaction.guild.id;
            const queue = this.controller.musicPlayerService.getQueue(guildId);

            // Check if queue is empty
            if (!queue.current && queue.tracks.length === 0) {
                await replyEphemeral(interaction, '❌ Queue is empty');
                return;
            }

            // Create queue embed
            const embed = this.controller.createQueueEmbed(queue, guildId);
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            this.controller.log(`Error in queue command: ${error.message}`, 'error');
            await this.controller.sendError(interaction, 'Failed to display queue');
        }
    }

    /**
     * Now playing command handler
     * Shows information about the currently playing track
     * @param {Object} interaction - Discord interaction
     */
    async nowplaying(interaction) {
        try {
            const guildId = interaction.guild.id;
            const current = this.controller.musicPlayerService.getCurrent(guildId);

            if (!current) {
                await replyEphemeral(interaction, '❌ Nothing is currently playing');
                return;
            }

            const queue = this.controller.musicPlayerService.getQueue(guildId);

            // Get current position if playing
            let currentPosition = null;
            if (this.controller.musicPlayerService.isPlaying(guildId)) {
                currentPosition = this.controller.musicPlayerService.getCurrentPosition(guildId);
            }

            const embed = this.controller.createNowPlayingEmbed(current, queue, currentPosition);
            const buttons = this.controller.createMusicControlButtons(guildId);

            await interaction.reply({ embeds: [embed], components: buttons });
        } catch (error) {
            this.controller.log(`Error in nowplaying command: ${error.message}`, 'error');
            await this.controller.sendError(interaction, 'Failed to display now playing');
        }
    }

    /**
     * Shuffle command handler
     * Shuffles the current queue
     * @param {Object} interaction - Discord interaction
     */
    async shuffle(interaction) {
        try {
            const guildId = interaction.guild.id;

            // Check DJ permissions
            const hasDJ = await this.controller.hasDJPermissions(interaction.member, guildId);
            if (!hasDJ) {
                await replyEphemeral(interaction, '❌ You need the DJ role to use this command');
                return;
            }

            const queue = this.controller.musicPlayerService.getQueue(guildId);
            if (queue.tracks.length === 0) {
                await replyEphemeral(interaction, '❌ Queue is empty');
                return;
            }

            // Shuffle queue using service
            await this.controller.musicPlayerService.shuffle(guildId);

            await interaction.reply(`🔀 Shuffled **${queue.tracks.length}** tracks`);
            this.controller.log(`Shuffled queue in guild ${guildId}`, 'info');
        } catch (error) {
            this.controller.log(`Error in shuffle command: ${error.message}`, 'error');
            await this.controller.sendError(interaction, 'Failed to shuffle queue');
        }
    }

    /**
     * Clear command handler
     * Clears all tracks from the queue
     * @param {Object} interaction - Discord interaction
     */
    async clear(interaction) {
        try {
            const guildId = interaction.guild.id;

            // Check DJ permissions
            const hasDJ = await this.controller.hasDJPermissions(interaction.member, guildId);
            if (!hasDJ) {
                await replyEphemeral(interaction, '❌ You need the DJ role to use this command');
                return;
            }

            const queue = this.controller.musicPlayerService.getQueue(guildId);
            if (queue.tracks.length === 0) {
                await replyEphemeral(interaction, '❌ Queue is already empty');
                return;
            }

            const trackCount = queue.tracks.length;

            // Clear queue using service
            await this.controller.musicPlayerService.clearQueue(guildId);

            await interaction.reply(`🗑️ Cleared **${trackCount}** tracks from queue`);
            this.controller.log(`Cleared queue in guild ${guildId}`, 'info');
        } catch (error) {
            this.controller.log(`Error in clear command: ${error.message}`, 'error');
            await this.controller.sendError(interaction, 'Failed to clear queue');
        }
    }

    /**
     * Remove command handler
     * Removes a specific track from the queue
     * @param {Object} interaction - Discord interaction
     */
    async remove(interaction) {
        try {
            const guildId = interaction.guild.id;
            const position = interaction.options.getInteger('position', true);

            // Check DJ permissions
            const hasDJ = await this.controller.hasDJPermissions(interaction.member, guildId);
            if (!hasDJ) {
                await replyEphemeral(interaction, '❌ You need the DJ role to use this command');
                return;
            }

            // Remove track using service (QueueManager.remove is 1-based)
            const removed = await this.controller.musicPlayerService.removeTrack(guildId, position);

            if (removed) {
                await interaction.reply(`🗑️ Removed **${removed.title}** from queue`);
                this.controller.log(`Removed track at position ${position} in guild ${guildId}`, 'info');
            } else {
                await replyEphemeral(interaction, `❌ No track at position ${position}`);
            }
        } catch (error) {
            this.controller.log(`Error in remove command: ${error.message}`, 'error');
            await this.controller.sendError(interaction, 'Failed to remove track');
        }
    }

    /**
     * Jump command handler
     * Jumps to a specific track in the queue
     * @param {Object} interaction - Discord interaction
     */
    async jump(interaction) {
        try {
            const guildId = interaction.guild.id;
            const position = interaction.options.getInteger('position', true);

            // Check DJ permissions
            const hasDJ = await this.controller.hasDJPermissions(interaction.member, guildId);
            if (!hasDJ) {
                await replyEphemeral(interaction, '❌ You need the DJ role to use this command');
                return;
            }

            // Jump to track using service (QueueManager.skipTo is 1-based)
            const track = await this.controller.musicPlayerService.jumpTo(guildId, position);

            if (track) {
                await interaction.reply(`⏭️ Jumped to **${track.title}**`);
                this.controller.log(`Jumped to position ${position} in guild ${guildId}`, 'info');
            } else {
                await replyEphemeral(interaction, `❌ No track at position ${position}`);
            }
        } catch (error) {
            this.controller.log(`Error in jump command: ${error.message}`, 'error');
            await this.controller.sendError(interaction, 'Failed to jump to track');
        }
    }

    /**
     * Move command handler
     * Moves a track to a different position in the queue
     * @param {Object} interaction - Discord interaction
     */
    async move(interaction) {
        try {
            const guildId = interaction.guild.id;
            const from = interaction.options.getInteger('from', true);
            const to = interaction.options.getInteger('to', true);

            // Check DJ permissions
            const hasDJ = await this.controller.hasDJPermissions(interaction.member, guildId);
            if (!hasDJ) {
                await replyEphemeral(interaction, '❌ You need the DJ role to use this command');
                return;
            }

            // Move track using service (QueueManager.move is 1-based)
            const success = await this.controller.musicPlayerService.moveTrack(guildId, from, to);

            if (success) {
                await interaction.reply(`↔️ Moved track from position **${from}** to **${to}**`);
                this.controller.log(`Moved track from ${from} to ${to} in guild ${guildId}`, 'info');
            } else {
                await replyEphemeral(interaction, '❌ Failed to move track');
            }
        } catch (error) {
            this.controller.log(`Error in move command: ${error.message}`, 'error');
            await this.controller.sendError(interaction, 'Failed to move track');
        }
    }
}

module.exports = QueueHandler;
