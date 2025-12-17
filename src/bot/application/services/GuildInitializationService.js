/**
 * GuildInitializationService
 * 
 * Service for initializing guild and member data when bot joins a guild.
 * Handles batch processing for large guilds and creates necessary database records.
 */

const BaseService = require('../../system/core/BaseService');

class GuildInitializationService extends BaseService {
    /**
     * Create a new GuildInitializationService instance
     * @param {Object} client - Discord client instance
     * @param {Object} options - Service configuration options
     */
    constructor(client, options = {}) {
        super(client, options);

        // Batch size for member initialization (500 per batch)
        this.batchSize = options.batchSize || 500;

        // Delay between batches in milliseconds (1 second)
        this.batchDelay = options.batchDelay || 1000;

        // Reference to GuildConfigService (will be set during initialization)
        this.guildConfigService = null;
    }

    /**
     * Initialize service
     * @returns {Promise<void>}
     */
    async initialize() {
        await super.initialize();

        // Get GuildConfigService reference from admin module
        try {
            const adminModule = this.client.modules.get('admin');
            if (adminModule) {
                this.guildConfigService = adminModule.getService('GuildConfigService');
            }
        } catch (error) {
            this.log('GuildConfigService not available, using defaults', 'warn');
        }

        this.log('GuildInitializationService initialized', 'info');
    }


    /**
     * Initialize a guild with default configuration and member data
     * @param {Object} guild - Discord guild object
     * @returns {Promise<Object>} Initialization result
     */
    async initializeGuild(guild) {
        try {
            this.log(`Initializing guild: ${guild.name} (${guild.id})`, 'info');

            // Check if guild is already initialized
            const isInitialized = await this.isGuildInitialized(guild.id);
            if (isInitialized) {
                this.log(`Guild ${guild.id} is already initialized`, 'info');
                return {
                    success: true,
                    alreadyInitialized: true,
                    guildId: guild.id,
                };
            }

            // Save guild data to database with retry logic
            await this.retryWithBackoff(async () => {
                await this.saveGuildData(guild);
            });

            // Fetch all members from guild
            this.log(`Fetching members for guild ${guild.id}`, 'info');
            const members = await guild.members.fetch();
            const memberArray = Array.from(members.values());

            this.log(`Found ${memberArray.length} members in guild ${guild.id}`, 'info');

            // Initialize members in batches
            const memberCount = await this.batchInitializeMembers(guild, memberArray);

            // Send welcome message to system channel
            await this.sendWelcomeMessage(guild);

            // Emit guildInitialized event
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
     * @param {Object} guild - Discord guild object
     * @returns {Promise<void>}
     */
    async saveGuildData(guild) {
        const db = this.getDatabase();
        if (!db) {
            throw new Error('Database connection not available');
        }

        // Create default configuration
        const defaultConfig = {
            prefix: '!',
            dj_role: null,
            volume_default: 80,
            max_queue_size: 100,
            welcome_enabled: false,
            welcome_channel: null,
            welcome_message: 'Welcome {user} to {server}! You are member #{memberCount}.',
            auto_role: null,
            moderation_log_channel: null,
            leveling_xp_multiplier: 1.0,
            economy_starting_balance: 1000,
        };

        const configJson = JSON.stringify(defaultConfig);

        // Insert or update guild record
        const now = Math.floor(Date.now() / 1000);

        await db.query(
            `INSERT INTO guilds (guild_id, guild_name, config, id, updated_at) 
             VALUES (?, ?, ?, ?, ?) 
             ON CONFLICT(guild_id) DO UPDATE SET 
                guild_name = excluded.guild_name,
                config = excluded.config,
                id = excluded.id,
                updated_at = excluded.updated_at`,
            [guild.id, guild.name, configJson, guild.id, now]
        );

        this.log(`Saved guild data for ${guild.id}`, 'debug');
    }


    /**
     * Initialize a single member with database records
     * @param {Object} guild - Discord guild object
     * @param {Object} member - Discord member object
     * @returns {Promise<boolean>} True if initialized, false if skipped
     */
    async initializeMember(guild, member) {
        try {
            // Skip bot accounts
            if (member.user.bot) {
                this.log(`Skipping bot account: ${member.user.tag}`, 'debug');
                return false;
            }

            const db = this.getDatabase();
            if (!db) {
                throw new Error('Database connection not available');
            }

            const now = Math.floor(Date.now() / 1000);

            // Create unique member ID
            const memberId = `${guild.id}-${member.user.id}-${Date.now()}`;

            // Check if member already exists
            const existingMember = await db.query(
                'SELECT id FROM members WHERE user_id = ? AND guild_id = ?',
                [member.user.id, guild.id]
            );

            if (existingMember && existingMember.length > 0) {
                this.log(`Member ${member.user.tag} already exists in guild ${guild.id}`, 'debug');
                return false;
            }

            // Upsert user profile to satisfy FK constraints
            await db.query(
                `INSERT INTO user_profiles (user_id, username, discriminator, avatar_url, bot, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(user_id) DO UPDATE SET
                    username = excluded.username,
                    discriminator = excluded.discriminator,
                    avatar_url = excluded.avatar_url,
                    bot = excluded.bot,
                    updated_at = excluded.updated_at`,
                [
                    member.user.id,
                    member.user.username,
                    member.user.discriminator ?? null,
                    member.user.displayAvatarURL?.() ?? null,
                    member.user.bot ? 1 : 0,
                    now,
                    now
                ]
            );

            // Get starting balance from guild config
            let startingBalance = 1000; // Default
            if (this.guildConfigService) {
                try {
                    startingBalance = await this.guildConfigService.getSetting(guild.id, 'economy_starting_balance');
                } catch (error) {
                    this.log('Failed to get starting balance from config, using default', 'warn');
                }
            }

            // Insert member record
            await db.query(
                'INSERT INTO members (id, guild_id, user_id) VALUES (?, ?, ?)',
                [memberId, guild.id, member.user.id]
            );

            // Create economy record with starting balance
            await db.query(
                'INSERT INTO economy (member_id, balance, bank_balance) VALUES (?, ?, ?)',
                [memberId, startingBalance, 0]
            );

            // Create leveling record with level 1
            await db.query(
                'INSERT INTO leveling (member_id, guild_id, user_id, xp, level, total_messages) VALUES (?, ?, ?, ?, ?, ?)',
                [memberId, guild.id, member.user.id, 0, 1, 0]
            );

            this.log(`Initialized member: ${member.user.tag} (${member.user.id})`, 'debug');
            return true;
        } catch (error) {
            this.handleError(error, 'initializeMember', {
                guildId: guild.id,
                userId: member.user.id,
            });
            // Don't throw - continue with other members
            return false;
        }
    }


    /**
     * Initialize members in batches to avoid rate limits and memory issues
     * @param {Object} guild - Discord guild object
     * @param {Array} members - Array of Discord member objects
     * @returns {Promise<number>} Number of members initialized
     */
    async batchInitializeMembers(guild, members) {
        try {
            // Filter out bot accounts
            const humanMembers = members.filter(member => !member.user.bot);

            this.log(`Initializing ${humanMembers.length} human members in batches of ${this.batchSize}`, 'info');

            let totalInitialized = 0;
            const batches = [];

            // Split members into batches
            for (let i = 0; i < humanMembers.length; i += this.batchSize) {
                batches.push(humanMembers.slice(i, i + this.batchSize));
            }

            this.log(`Processing ${batches.length} batches`, 'info');

            // Process each batch
            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const batch = batches[batchIndex];

                this.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} members)`, 'info');

                // Process batch within a transaction for better performance
                const batchResult = await this.processBatchInTransaction(guild, batch);
                totalInitialized += batchResult;

                this.log(`Batch ${batchIndex + 1}/${batches.length} complete: ${batchResult} members initialized`, 'info');

                // Add delay between batches to avoid rate limits (except for last batch)
                if (batchIndex < batches.length - 1) {
                    await this.sleep(this.batchDelay);
                }
            }

            this.log(`Batch initialization complete: ${totalInitialized} members initialized`, 'info');
            return totalInitialized;
        } catch (error) {
            this.handleError(error, 'batchInitializeMembers', { guildId: guild.id });
            throw error;
        }
    }

    /**
     * Process a batch of members within a database transaction
     * @param {Object} guild - Discord guild object
     * @param {Array} batch - Array of member objects
     * @returns {Promise<number>} Number of members initialized in this batch
     */
    async processBatchInTransaction(guild, batch) {
        const db = this.getDatabase();
        if (!db) {
            throw new Error('Database connection not available');
        }

        let initialized = 0;

        try {
            // Get starting balance once for the batch
            let startingBalance = 1000; // Default
            if (this.guildConfigService) {
                try {
                    startingBalance = await this.guildConfigService.getSetting(guild.id, 'economy_starting_balance');
                } catch (error) {
                    this.log('Failed to get starting balance from config, using default', 'warn');
                }
            }

            // Begin transaction
            db.beginTransaction();

            for (const member of batch) {
                try {
                    const now = Math.floor(Date.now() / 1000);

                    // Upsert user profile to satisfy FK constraints
                    await db.query(
                        `INSERT INTO user_profiles (user_id, username, discriminator, avatar_url, bot, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?)
                         ON CONFLICT(user_id) DO UPDATE SET
                            username = excluded.username,
                            discriminator = excluded.discriminator,
                            avatar_url = excluded.avatar_url,
                            bot = excluded.bot,
                            updated_at = excluded.updated_at`,
                        [
                            member.user.id,
                            member.user.username,
                            member.user.discriminator ?? null,
                            member.user.displayAvatarURL?.() ?? null,
                            member.user.bot ? 1 : 0,
                            now,
                            now
                        ]
                    );

                    // Check if member already exists
                    const existingMember = await db.query(
                        'SELECT id FROM members WHERE user_id = ? AND guild_id = ?',
                        [member.user.id, guild.id]
                    );

                    if (existingMember && existingMember.length > 0) {
                        continue; // Skip existing members
                    }

                    // Create unique member ID
                    const memberId = `${guild.id}-${member.user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

                    // Insert member record
                    await db.query(
                        'INSERT INTO members (id, guild_id, user_id) VALUES (?, ?, ?)',
                        [memberId, guild.id, member.user.id]
                    );

                    // Create economy record
                    await db.query(
                        'INSERT INTO economy (member_id, balance, bank_balance) VALUES (?, ?, ?)',
                        [memberId, startingBalance, 0]
                    );

                    // Create leveling record
                    await db.query(
                        'INSERT INTO leveling (member_id, guild_id, user_id, xp, level, total_messages) VALUES (?, ?, ?, ?, ?, ?)',
                        [memberId, guild.id, member.user.id, 0, 1, 0]
                    );

                    initialized++;
                } catch (memberError) {
                    this.log(`Error initializing member ${member.user.tag}: ${memberError.message}`, 'warn');
                    // Continue with other members
                }
            }

            // Commit transaction
            db.commit();

            return initialized;
        } catch (error) {
            // Rollback transaction on error
            try {
                db.rollback();
            } catch (rollbackError) {
                this.log(`Error rolling back transaction: ${rollbackError.message}`, 'error');
            }

            this.handleError(error, 'processBatchInTransaction', { guildId: guild.id });
            throw error;
        }
    }


    /**
     * Check if a guild is already initialized
     * @param {string} guildId - Guild ID
     * @returns {Promise<boolean>} True if initialized
     */
    async isGuildInitialized(guildId) {
        try {
            const db = this.getDatabase();
            if (!db) {
                throw new Error('Database connection not available');
            }

            const result = await db.query(
                'SELECT guild_id FROM guilds WHERE guild_id = ?',
                [guildId]
            );

            return result && result.length > 0;
        } catch (error) {
            this.handleError(error, 'isGuildInitialized', { guildId });
            return false;
        }
    }

    /**
     * Send welcome message to guild's system channel
     * @param {Object} guild - Discord guild object
     * @returns {Promise<void>}
     */
    async sendWelcomeMessage(guild) {
        try {
            // Find system channel or first text channel
            let channel = guild.systemChannel;

            if (!channel) {
                // Try to find first text channel where bot can send messages
                const channels = guild.channels.cache.filter(
                    ch => ch.type === 0 && ch.permissionsFor(guild.members.me).has('SendMessages')
                );

                if (channels.size > 0) {
                    channel = channels.first();
                }
            }

            if (!channel) {
                this.log(`No suitable channel found for welcome message in guild ${guild.id}`, 'warn');
                return;
            }

            // Create welcome embed
            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('👋 Thanks for adding me!')
                .setDescription(
                    `Hello **${guild.name}**! I'm ready to serve your server.\n\n` +
                    `I've initialized all member data and I'm ready to go!\n\n` +
                    `**Quick Start:**\n` +
                    `• Use \`/help\` to see all available commands\n` +
                    `• Use \`/config\` to customize my settings\n` +
                    `• Check out my music, economy, leveling, and moderation features!\n\n` +
                    `Need help? Use \`/help\` or check the documentation.`
                )
                .setTimestamp()
                .setFooter({ text: `Guild ID: ${guild.id}` });

            await channel.send({ embeds: [embed] });

            this.log(`Sent welcome message to guild ${guild.id}`, 'info');
        } catch (error) {
            this.handleError(error, 'sendWelcomeMessage', { guildId: guild.id });
            // Don't throw - welcome message is not critical
        }
    }
}

module.exports = GuildInitializationService;
