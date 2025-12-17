/**
 * Presence Manager
 * 
 * Manages bot presence, status, and activity rotation
 */

const { ActivityType, PresenceUpdateStatus } = require('discord.js');

class PresenceManager {
    /**
     * Create a new PresenceManager instance
     * @param {Object} client - Discord client instance
     * @param {Object} options - Configuration options
     */
    constructor(client, options = {}) {
        this.client = client;
        this.options = {
            rotationInterval: options.rotationInterval || 60000, // 1 minute
            activities: options.activities || [],
            defaultStatus: options.defaultStatus || 'online',
            shardAware: options.shardAware || false,
            ...options,
        };

        this.currentActivityIndex = 0;
        this.rotationTimer = null;
        this.isRotating = false;
    }

    /**
     * Set bot presence
     * @param {Object} presence - Presence configuration
     * @param {string} presence.status - online, idle, dnd, invisible
     * @param {Array} presence.activities - Array of activity objects
     * @param {string} presence.customStatus - Custom status text
     * @param {string} presence.customStatusEmoji - Custom status emoji
     * @param {number} shardId - Optional shard ID for shard-specific presence
     * @returns {Promise<void>}
     */
    async set_presence(presence, shardId = null) {
        try {
            const presence_data = {
                status: presence.status || this.options.defaultStatus,
                activities: presence.activities || [],
            };

            // Add custom status if provided
            if (presence.customStatus || presence.customStatusEmoji) {
                presence_data.activities.push({
                    name: presence.customStatus || '',
                    type: ActivityType.Custom,
                    state: presence.customStatus,
                });
            }

            if (shardId !== null && this.options.shardAware) {
                // Set presence for specific shard
                const shard = this.client.shard;
                if (shard) {
                    await shard.broadcastEval(
                        (client, { presence_data, target_shard }) => {
                            if (client.shard.ids[0] === target_shard) {
                                return client.user.setPresence(presence_data);
                            }
                        },
                        { context: { presence_data, target_shard: shardId } }
                    );
                }
            } else {
                // Set presence for all shards or single instance
                await this.client.user.setPresence(presence_data);
            }
        } catch (error) {
            const logger = require('../helpers/logger_helper');
            logger.error('Failed to set presence', {
                error: error.message,
                presence,
            });
            throw error;
        }
    }

    /**
     * Set playing activity
     * @param {string} name - Activity name
     * @param {string} url - Optional streaming URL
     * @returns {Promise<void>}
     */
    async set_playing(name, url = null) {
        const activity = {
            name,
            type: url ? ActivityType.Streaming : ActivityType.Playing,
        };
        if (url) {
            activity.url = url;
        }

        await this.set_presence({
            activities: [activity],
        });
    }

    /**
     * Set listening activity
     * @param {string} name - Activity name
     * @returns {Promise<void>}
     */
    async set_listening(name) {
        await this.set_presence({
            activities: [
                {
                    name,
                    type: ActivityType.Listening,
                },
            ],
        });
    }

    /**
     * Set watching activity
     * @param {string} name - Activity name
     * @returns {Promise<void>}
     */
    async set_watching(name) {
        await this.set_presence({
            activities: [
                {
                    name,
                    type: ActivityType.Watching,
                },
            ],
        });
    }

    /**
     * Set competing activity
     * @param {string} name - Activity name
     * @returns {Promise<void>}
     */
    async set_competing(name) {
        await this.set_presence({
            activities: [
                {
                    name,
                    type: ActivityType.Competing,
                },
            ],
        });
    }

    /**
     * Set custom status
     * @param {string} text - Status text
     * @param {string} emoji - Optional emoji
     * @returns {Promise<void>}
     */
    async set_custom_status(text, emoji = null) {
        await this.set_presence({
            customStatus: text,
            customStatusEmoji: emoji,
        });
    }

    /**
     * Start activity rotation
     * @param {Array} activities - Array of activity configurations
     * @param {number} interval - Rotation interval in milliseconds
     * @returns {void}
     */
    start_rotation(activities = null, interval = null) {
        if (this.isRotating) {
            this.stop_rotation();
        }

        const activities_to_use = activities || this.options.activities;
        if (!activities_to_use || activities_to_use.length === 0) {
            return;
        }

        this.isRotating = true;
        const rotation_interval = interval || this.options.rotationInterval;

        // Set initial activity
        this._set_activity_from_index(0, activities_to_use);

        // Rotate activities
        this.rotationTimer = setInterval(() => {
            this.currentActivityIndex = (this.currentActivityIndex + 1) % activities_to_use.length;
            this._set_activity_from_index(this.currentActivityIndex, activities_to_use);
        }, rotation_interval);
    }

    /**
     * Stop activity rotation
     * @returns {void}
     */
    stop_rotation() {
        if (this.rotationTimer) {
            clearInterval(this.rotationTimer);
            this.rotationTimer = null;
        }
        this.isRotating = false;
    }

    /**
     * Set activity from index
     * @param {number} index - Activity index
     * @param {Array} activities - Activities array
     * @private
     */
    async _set_activity_from_index(index, activities) {
        const activity_config = activities[index];
        if (!activity_config) {
            return;
        }

        const activity = {
            name: activity_config.name,
            type: this._get_activity_type(activity_config.type),
        };

        if (activity_config.url) {
            activity.url = activity_config.url;
        }

        await this.set_presence({
            activities: [activity],
            status: activity_config.status || this.options.defaultStatus,
        });
    }

    /**
     * Get activity type from string
     * @param {string} type - Activity type string
     * @returns {ActivityType} Activity type enum
     * @private
     */
    _get_activity_type(type) {
        const type_map = {
            playing: ActivityType.Playing,
            streaming: ActivityType.Streaming,
            listening: ActivityType.Listening,
            watching: ActivityType.Watching,
            competing: ActivityType.Competing,
            custom: ActivityType.Custom,
        };

        return type_map[type?.toLowerCase()] || ActivityType.Playing;
    }

    /**
     * Update bot username
     * @param {string} username - New username
     * @returns {Promise<void>}
     */
    async update_username(username) {
        try {
            await this.client.user.setUsername(username);
        } catch (error) {
            const logger = require('../helpers/logger_helper');
            logger.error('Failed to update username', {
                error: error.message,
                username,
            });
            throw error;
        }
    }

    /**
     * Update bot avatar
     * @param {string|Buffer} avatar - Avatar URL or buffer
     * @returns {Promise<void>}
     */
    async update_avatar(avatar) {
        try {
            await this.client.user.setAvatar(avatar);
        } catch (error) {
            const logger = require('../helpers/logger_helper');
            logger.error('Failed to update avatar', {
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Update bot banner
     * @param {string|Buffer} banner - Banner URL or buffer
     * @returns {Promise<void>}
     */
    async update_banner(banner) {
        try {
            await this.client.user.setBanner(banner);
        } catch (error) {
            const logger = require('../helpers/logger_helper');
            logger.error('Failed to update banner', {
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Shutdown presence manager
     * @returns {void}
     */
    shutdown() {
        this.stop_rotation();
    }
}

module.exports = PresenceManager;
