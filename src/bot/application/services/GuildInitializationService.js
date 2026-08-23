'use strict';

/**
 * GuildInitializationService
 * 
 * Service for initializing guild and member data when bot joins a guild.
 * Handles batch processing for large guilds and creates necessary database records.
 * Synchronized with consolidated schema.
 */

const BaseService = require('../../system/core/BaseService');

class GuildInitializationService extends BaseService {
    constructor(client, options = {}) {
        super(client, options);

        this.batchSize = options.batchSize || 500;
        this.batchDelay = options.batchDelay || 500;
        this.guildConfigService = null;
    }

    async initialize() {
        await super.initialize();

        try {
            const adminModule = this.client.modules.get('admin');
            if (adminModule) {
                this.guildConfigService = adminModule.getService('GuildConfigService');
            }
        } catch {
            this.log('GuildConfigService not available, using defaults', 'warn');
        }

        this.log('GuildInitializationService initialized', 'info');
    }

    /**
     * Initialize a guild with default configuration and member data
     * @param {Object} guild - Discord guild object
     * @returns {Promise<Object>}
     */
    async initializeGuild(guild) {
        try {
            this.log(`Initializing guild: ${guild.name} (${guild.id})`, 'info');

            const isInitialized = await this.isGuildInitialized(guild.id);
            if (isInitialized) {
                this.log(`Guild ${guild.id} is already initialized`, 'info');
                return {
                    success: true,
                    alreadyInitialized: true,
                    guildId: guild.id,
                };
            }

            // Save guild data
            await this.saveGuildData(guild);

            // Fetch members
            this.log(`Fetching members for guild ${guild.id}`, 'info');
            const members = await guild.members.fetch();
            const memberArray = Array.from(members.values());

            this.log(`Found ${memberArray.length} members in guild ${guild.id}`, 'info');

            // Initialize members in batches
            const memberCount = await this.batchInitializeMembers(guild, memberArray);

            // Send welcome message
            await this.sendWelcomeMessage(guild);

            if (this.client.eventManager) {
                this.client.eventManager.emit('guildInitialized', {
                    guildId: guild.id,
                    guildName: guild.name,
                    memberCount,
                });
            }

            this.log(`Successfully initialized guild ${guild.id} with ${memberCount} members`, 'info');

            return {
                success: true,
                guildId: guild.id,
                guildName: guild.name,
                memberCount,
            };
        } catch (error) {
            this.handleError(error, 'initializeGuild', { guildId: guild.id });
            throw error;
        }
    }

    /**
     * Save guild data to database
     * @param {Object} guild
     */
    async saveGuildData(guild) {
        const db = this.getDatabase();
        if (!db) throw new Error('Database connection not available');

        const defaultConfig = {
            prefix: '!',
            dj_role: null,
            volume_default: 80,
            max_queue_size: 100,
            welcome_enabled: false,
            welcome_channel: null,
            welcome_message: 'Welcome {user} to {server}!',
            auto_role: null,
            moderation_log_channel: null,
            leveling_xp_multiplier: 1.0,
            economy_starting_balance: 1000,
        };

        const configJson = JSON.stringify(defaultConfig);
        const now = Math.floor(Date.now() / 1000);

        await db.query(
            `INSERT INTO guilds (guild_id, name, config_json, prefix, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(guild_id) DO UPDATE SET
                name = excluded.name,
                config_json = excluded.config_json,
                updated_at = excluded.updated_at`,
            [guild.id, guild.name, configJson, '!', now, now]
        );

        this.log(`Saved guild data for ${guild.id}`, 'debug');
    }

    /**
     * Initialize a single member
     * @param {Object} guild
     * @param {Object} member
     * @returns {Promise<boolean>}
     */
    async initializeMember(guild, member) {
        try {
            if (member.user.bot) return false;

            const db = this.getDatabase();
            if (!db) throw new Error('Database connection not available');

            const now = Math.floor(Date.now() / 1000);
            let startingBalance = 1000;

            if (this.guildConfigService) {
                try {
                    startingBalance = await this.guildConfigService.getSetting(guild.id, 'economy_starting_balance');
                } catch {
                    // ignore
                }
            }

            // Upsert user profile
            await db.query(
                `INSERT INTO user_profiles (user_id, username, discriminator, avatar_url, bot, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(user_id) DO UPDATE SET
                    username = excluded.username,
                    discriminator = excluded.discriminator,
                    avatar_url = excluded.avatar_url,
                    updated_at = excluded.updated_at`,
                [
                    member.user.id,
                    member.user.username,
                    member.user.discriminator ?? null,
                    member.user.displayAvatarURL?.() ?? null,
                    0,
                    now,
                    now
                ]
            );

            // Upsert economy account
            await db.query(
                `INSERT INTO economy_accounts (user_id, guild_id, balance, bank_balance, created_at, updated_at)
                 VALUES (?, ?, ?, 0, ?, ?)
                 ON CONFLICT(user_id, guild_id) DO NOTHING`,
                [member.user.id, guild.id, startingBalance, now, now]
            );

            // Upsert user levels
            await db.query(
                `INSERT INTO user_levels (user_id, guild_id, xp, level, created_at, updated_at)
                 VALUES (?, ?, 0, 0, ?, ?)
                 ON CONFLICT(user_id, guild_id) DO NOTHING`,
                [member.user.id, guild.id, now, now]
            );

            return true;
        } catch (error) {
            this.handleError(error, 'initializeMember', {
                guildId: guild.id,
                userId: member.user.id,
            });
            return false;
        }
    }

    /**
     * Batch initialize members
     * @param {Object} guild
     * @param {Array} members
     * @returns {Promise<number>}
     */
    async batchInitializeMembers(guild, members) {
        try {
            const humanMembers = members.filter(member => !member.user.bot);
            this.log(`Initializing ${humanMembers.length} human members in batches of ${this.batchSize}`, 'info');

            let totalInitialized = 0;
            const batches = [];

            for (let i = 0; i < humanMembers.length; i += this.batchSize) {
                batches.push(humanMembers.slice(i, i + this.batchSize));
            }

            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const batch = batches[batchIndex];
                const batchResult = await this.processBatchInTransaction(guild, batch);
                totalInitialized += batchResult;

                if (batchIndex < batches.length - 1) {
                    await this.sleep(this.batchDelay);
                }
            }

            return totalInitialized;
        } catch (error) {
            this.handleError(error, 'batchInitializeMembers', { guildId: guild.id });
            throw error;
        }
    }

    /**
     * Process batch of members
     * @param {Object} guild
     * @param {Array} batch
     * @returns {Promise<number>}
     */
    async processBatchInTransaction(guild, batch) {
        const db = this.getDatabase();
        if (!db) throw new Error('Database connection not available');

        let initialized = 0;

        try {
            let startingBalance = 1000;
            if (this.guildConfigService) {
                try {
                    startingBalance = await this.guildConfigService.getSetting(guild.id, 'economy_starting_balance');
                } catch {
                    // ignore
                }
            }

            await db.transaction(async (tx) => {
                const now = Math.floor(Date.now() / 1000);

                for (const member of batch) {
                    try {
                        await tx.query(
                            `INSERT INTO user_profiles (user_id, username, discriminator, avatar_url, bot, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?)
                             ON CONFLICT(user_id) DO UPDATE SET
                                username = excluded.username,
                                discriminator = excluded.discriminator,
                                avatar_url = excluded.avatar_url,
                                updated_at = excluded.updated_at`,
                            [
                                member.user.id,
                                member.user.username,
                                member.user.discriminator ?? null,
                                member.user.displayAvatarURL?.() ?? null,
                                0,
                                now,
                                now
                            ]
                        );

                        await tx.query(
                            `INSERT INTO economy_accounts (user_id, guild_id, balance, bank_balance, created_at, updated_at)
                             VALUES (?, ?, ?, 0, ?, ?)
                             ON CONFLICT(user_id, guild_id) DO NOTHING`,
                            [member.user.id, guild.id, startingBalance, now, now]
                        );

                        await tx.query(
                            `INSERT INTO user_levels (user_id, guild_id, xp, level, created_at, updated_at)
                             VALUES (?, ?, 0, 0, ?, ?)
                             ON CONFLICT(user_id, guild_id) DO NOTHING`,
                            [member.user.id, guild.id, now, now]
                        );

                        initialized++;
                    } catch (memberError) {
                        this.log(`Error initializing member ${member.user.tag}: ${memberError.message}`, 'warn');
                    }
                }
            });

            return initialized;
        } catch (error) {
            this.handleError(error, 'processBatchInTransaction', { guildId: guild.id });
            throw error;
        }
    }

    /**
     * Check if guild is initialized
     * @param {string} guildId
     * @returns {Promise<boolean>}
     */
    async isGuildInitialized(guildId) {
        try {
            const db = this.getDatabase();
            if (!db) return false;

            const result = await db.query(
                'SELECT guild_id FROM guilds WHERE guild_id = ?',
                [guildId]
            );

            return result && result.length > 0;
        } catch {
            return false;
        }
    }

    /**
     * Send welcome message
     * @param {Object} guild
     */
    async sendWelcomeMessage(guild) {
        try {
            let channel = guild.systemChannel;

            if (!channel) {
                const channels = guild.channels.cache.filter(
                    ch => ch.type === 0 && ch.permissionsFor(guild.members.me)?.has('SendMessages')
                );

                if (channels.size > 0) {
                    channel = channels.first();
                }
            }

            if (!channel) return;

            const ResponseHelper = require('../../system/helpers/ResponseHelper');
            const embed = ResponseHelper.createEmbed({
                color: ResponseHelper.THEMES.BRAND,
                title: '🚀 EyeDaemon Unified Activated!',
                description: [
                    `Hello **${guild.name}**! EyeDaemon is fully initialized and operational.`,
                    '',
                    '**Quick Start Guides:**',
                    '• Use `/help` to explore the master command menu and interactive guides.',
                    '• Use `/play <song>` to stream high-fidelity audio with real-time DSP filters.',
                    '• Use `/config view` or `/config set` to customize server settings.',
                    '',
                    ResponseHelper.subtext('High performance • In-process audio • Distributed LibSQL database')
                ].join('\n'),
                footerText: `Server ID: ${guild.id}`
            });

            await channel.send({ embeds: [embed] });
        } catch (error) {
            this.log(`Error sending welcome message: ${error.message}`, 'warn');
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = GuildInitializationService;
