/**
 * Guild Management Service
 * 
 * Handles guild metadata, channel management, and thread operations
 */

const { ChannelType, PermissionFlagsBits } = require('discord.js');
const logger = require('../helpers/logger_helper');
const { DatabaseError } = require('../core/Errors');

class GuildManagementService {
    /**
     * Create a new GuildManagementService instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        this.client = client;
        this.database = client.database;
    }

    /**
     * Update guild name
     * @param {string} guild_id - Guild ID
     * @param {string} name - New guild name
     * @returns {Promise<void>}
     */
    async update_guild_name(guild_id, name) {
        try {
            const guild = await this.client.guilds.fetch(guild_id);
            await guild.setName(name);

            logger.info(`Updated guild name: ${guild_id} -> ${name}`);
        } catch (error) {
            logger.error('Failed to update guild name', {
                error: error.message,
                guild_id,
                name,
            });
            throw new DatabaseError('Failed to update guild name', {
                originalError: error.message,
            });
        }
    }

    /**
     * Update guild icon
     * @param {string} guild_id - Guild ID
     * @param {string|Buffer} icon - Icon URL or buffer
     * @returns {Promise<void>}
     */
    async update_guild_icon(guild_id, icon) {
        try {
            const guild = await this.client.guilds.fetch(guild_id);
            await guild.setIcon(icon);

            logger.info(`Updated guild icon: ${guild_id}`);
        } catch (error) {
            logger.error('Failed to update guild icon', {
                error: error.message,
                guild_id,
            });
            throw new DatabaseError('Failed to update guild icon', {
                originalError: error.message,
            });
        }
    }

    /**
     * Update guild banner
     * @param {string} guild_id - Guild ID
     * @param {string|Buffer} banner - Banner URL or buffer
     * @returns {Promise<void>}
     */
    async update_guild_banner(guild_id, banner) {
        try {
            const guild = await this.client.guilds.fetch(guild_id);
            await guild.setBanner(banner);

            logger.info(`Updated guild banner: ${guild_id}`);
        } catch (error) {
            logger.error('Failed to update guild banner', {
                error: error.message,
                guild_id,
            });
            throw new DatabaseError('Failed to update guild banner', {
                originalError: error.message,
            });
        }
    }

    /**
     * Create a text channel
     * @param {string} guild_id - Guild ID
     * @param {string} name - Channel name
     * @param {Object} options - Channel options
     * @returns {Promise<Channel>}
     */
    async create_text_channel(guild_id, name, options = {}) {
        try {
            const guild = await this.client.guilds.fetch(guild_id);
            const channel = await guild.channels.create({
                name,
                type: ChannelType.GuildText,
                topic: options.topic,
                nsfw: options.nsfw || false,
                parent: options.parent_id,
                position: options.position,
                permissionOverwrites: options.permission_overwrites,
            });

            logger.info(`Created text channel: ${guild_id} -> ${name}`);
            return channel;
        } catch (error) {
            logger.error('Failed to create text channel', {
                error: error.message,
                guild_id,
                name,
            });
            throw new DatabaseError('Failed to create text channel', {
                originalError: error.message,
            });
        }
    }

    /**
     * Create a voice channel
     * @param {string} guild_id - Guild ID
     * @param {string} name - Channel name
     * @param {Object} options - Channel options
     * @returns {Promise<Channel>}
     */
    async create_voice_channel(guild_id, name, options = {}) {
        try {
            const guild = await this.client.guilds.fetch(guild_id);
            const channel = await guild.channels.create({
                name,
                type: ChannelType.GuildVoice,
                parent: options.parent_id,
                position: options.position,
                bitrate: options.bitrate || 64000,
                userLimit: options.user_limit,
                permissionOverwrites: options.permission_overwrites,
            });

            logger.info(`Created voice channel: ${guild_id} -> ${name}`);
            return channel;
        } catch (error) {
            logger.error('Failed to create voice channel', {
                error: error.message,
                guild_id,
                name,
            });
            throw new DatabaseError('Failed to create voice channel', {
                originalError: error.message,
            });
        }
    }

    /**
     * Create a thread
     * @param {string} channel_id - Parent channel ID
     * @param {string} name - Thread name
     * @param {Object} options - Thread options
     * @returns {Promise<ThreadChannel>}
     */
    async create_thread(channel_id, name, options = {}) {
        try {
            const channel = await this.client.channels.fetch(channel_id);
            const thread = await channel.threads.create({
                name,
                autoArchiveDuration: options.auto_archive_duration || 1440,
                type: options.private ? ChannelType.PrivateThread : ChannelType.PublicThread,
                invitable: options.invitable !== false,
            });

            logger.info(`Created thread: ${channel_id} -> ${name}`);
            return thread;
        } catch (error) {
            logger.error('Failed to create thread', {
                error: error.message,
                channel_id,
                name,
            });
            throw new DatabaseError('Failed to create thread', {
                originalError: error.message,
            });
        }
    }

    /**
     * Delete a channel
     * @param {string} channel_id - Channel ID
     * @param {string} reason - Deletion reason
     * @returns {Promise<void>}
     */
    async delete_channel(channel_id, reason = null) {
        try {
            const channel = await this.client.channels.fetch(channel_id);
            await channel.delete(reason);

            logger.info(`Deleted channel: ${channel_id}`);
        } catch (error) {
            logger.error('Failed to delete channel', {
                error: error.message,
                channel_id,
            });
            throw new DatabaseError('Failed to delete channel', {
                originalError: error.message,
            });
        }
    }

    /**
     * Get guild features
     * @param {string} guild_id - Guild ID
     * @returns {Promise<Array>}
     */
    async get_guild_features(guild_id) {
        try {
            const guild = await this.client.guilds.fetch(guild_id);
            return guild.features;
        } catch (error) {
            logger.error('Failed to get guild features', {
                error: error.message,
                guild_id,
            });
            throw new DatabaseError('Failed to get guild features', {
                originalError: error.message,
            });
        }
    }

    /**
     * Get guild vanity URL
     * @param {string} guild_id - Guild ID
     * @returns {Promise<string|null>}
     */
    async get_guild_vanity_url(guild_id) {
        try {
            const guild = await this.client.guilds.fetch(guild_id);
            const vanity = await guild.fetchVanityData();
            return vanity?.code || null;
        } catch (error) {
            // Vanity URL might not be available
            return null;
        }
    }
}

module.exports = GuildManagementService;
