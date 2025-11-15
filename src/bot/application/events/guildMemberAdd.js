/**
 * GuildMemberAdd Event Handler
 * 
 * Fired when a new member joins a guild.
 * Handles member initialization, welcome messages, and auto-role assignment.
 */

const BaseEvent = require('../../system/core/BaseEvent');

class GuildMemberAddEvent extends BaseEvent {
    constructor(client) {
        super(client, {
            name: 'guildMemberAdd',
            once: false,
        });
    }

    async execute(member) {
        this.log(`New member joined: ${member.user.tag} in guild ${member.guild.name}`, 'info');

        try {
            // Initialize member data
            await this.initializeMember(member);

            // Send welcome message if enabled
            await this.sendWelcomeMessage(member);

            // Assign auto-role if configured
            await this.assignAutoRole(member);
        } catch (error) {
            await this.handleError(error, member);
        }
    }

    /**
     * Initialize member in database
     * @param {Object} member - Discord member object
     */
    async initializeMember(member) {
        try {
            // Get GuildInitializationService
            const guildInitService = this.getGuildInitializationService();

            if (!guildInitService) {
                this.log('GuildInitializationService not available, skipping member initialization', 'warn');
                return;
            }

            // Initialize member using service
            const initialized = await guildInitService.initializeMember(member.guild, member);

            if (initialized) {
                this.log(`Member ${member.user.tag} initialized successfully`, 'info');
            } else {
                this.log(`Member ${member.user.tag} was not initialized (bot or already exists)`, 'debug');
            }
        } catch (error) {
            this.log('Failed to initialize member', 'error', {
                guildId: member.guild.id,
                userId: member.user.id,
                error: error.message,
                stack: error.stack,
            });
        }
    }

    /**
     * Send welcome message to new member
     * @param {Object} member - Discord member object
     */
    async sendWelcomeMessage(member) {
        try {
            // Get guild config service
            const guildConfigService = this.getGuildConfigService();

            if (!guildConfigService) {
                this.log('GuildConfigService not available, skipping welcome message', 'debug');
                return;
            }

            // Check if welcome messages are enabled
            const welcomeEnabled = await guildConfigService.getSetting(member.guild.id, 'welcome_enabled');

            if (!welcomeEnabled) {
                this.log(`Welcome messages disabled for guild ${member.guild.id}`, 'debug');
                return;
            }

            // Get welcome channel
            const welcomeChannelId = await guildConfigService.getSetting(member.guild.id, 'welcome_channel');

            if (!welcomeChannelId) {
                this.log(`No welcome channel configured for guild ${member.guild.id}`, 'debug');
                return;
            }

            // Get welcome channel from guild
            const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);

            if (!welcomeChannel) {
                this.log(`Welcome channel ${welcomeChannelId} not found in guild ${member.guild.id}`, 'warn');
                return;
            }

            // Check bot permissions
            const permissions = welcomeChannel.permissionsFor(member.guild.members.me);
            if (!permissions || !permissions.has('SendMessages')) {
                this.log(`Bot lacks SendMessages permission in welcome channel ${welcomeChannelId}`, 'warn');
                return;
            }

            // Get welcome message template
            let welcomeMessage = await guildConfigService.getSetting(
                member.guild.id,
                'welcome_message'
            );

            if (!welcomeMessage) {
                welcomeMessage = 'Welcome {user} to {server}! You are member #{memberCount}.';
            }

            // Replace placeholders
            const memberCount = member.guild.memberCount;
            welcomeMessage = welcomeMessage
                .replace(/{user}/g, `<@${member.user.id}>`)
                .replace(/{server}/g, member.guild.name)
                .replace(/{memberCount}/g, memberCount.toString());

            // Send welcome message
            await welcomeChannel.send(welcomeMessage);

            this.log(`Sent welcome message for ${member.user.tag} in guild ${member.guild.name}`, 'info');
        } catch (error) {
            this.log('Failed to send welcome message', 'error', {
                guildId: member.guild.id,
                userId: member.user.id,
                error: error.message,
                stack: error.stack,
            });
        }
    }

    /**
     * Assign auto-role to new member
     * @param {Object} member - Discord member object
     */
    async assignAutoRole(member) {
        try {
            // Get guild config service
            const guildConfigService = this.getGuildConfigService();

            if (!guildConfigService) {
                this.log('GuildConfigService not available, skipping auto-role', 'debug');
                return;
            }

            // Get auto-role setting
            const autoRoleId = await guildConfigService.getSetting(member.guild.id, 'auto_role');

            if (!autoRoleId) {
                this.log(`No auto-role configured for guild ${member.guild.id}`, 'debug');
                return;
            }

            // Get role from guild
            const role = member.guild.roles.cache.get(autoRoleId);

            if (!role) {
                this.log(`Auto-role ${autoRoleId} not found in guild ${member.guild.id}`, 'warn');
                return;
            }

            // Check role hierarchy
            const botMember = member.guild.members.me;
            if (role.position >= botMember.roles.highest.position) {
                this.log(
                    `Cannot assign auto-role ${role.name}: role is higher than bot's highest role`,
                    'warn',
                    {
                        guildId: member.guild.id,
                        roleId: autoRoleId,
                        roleName: role.name,
                    }
                );
                return;
            }

            // Check bot permissions
            if (!botMember.permissions.has('ManageRoles')) {
                this.log(`Bot lacks ManageRoles permission in guild ${member.guild.id}`, 'warn');
                return;
            }

            // Assign role to member
            await member.roles.add(role, 'Auto-role assignment');

            this.log(`Assigned auto-role ${role.name} to ${member.user.tag} in guild ${member.guild.name}`, 'info');

            // Log to moderation logs if configured
            await this.logAutoRoleAssignment(member, role);
        } catch (error) {
            this.log('Failed to assign auto-role', 'error', {
                guildId: member.guild.id,
                userId: member.user.id,
                error: error.message,
                stack: error.stack,
            });
        }
    }

    /**
     * Log auto-role assignment to moderation logs
     * @param {Object} member - Discord member object
     * @param {Object} role - Discord role object
     */
    async logAutoRoleAssignment(member, role) {
        try {
            // Get guild config service
            const guildConfigService = this.getGuildConfigService();

            if (!guildConfigService) {
                return;
            }

            // Get moderation log channel
            const modLogChannelId = await guildConfigService.getSetting(
                member.guild.id,
                'moderation_log_channel'
            );

            if (!modLogChannelId) {
                return;
            }

            // Get channel from guild
            const modLogChannel = member.guild.channels.cache.get(modLogChannelId);

            if (!modLogChannel) {
                return;
            }

            // Check bot permissions
            const permissions = modLogChannel.permissionsFor(member.guild.members.me);
            if (!permissions || !permissions.has('SendMessages')) {
                return;
            }

            // Create log embed
            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('Auto-Role Assigned')
                .setDescription(`Auto-role assigned to new member`)
                .addFields(
                    { name: 'Member', value: `${member.user.tag} (${member.user.id})`, inline: true },
                    { name: 'Role', value: `${role.name} (${role.id})`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `Member ID: ${member.user.id}` });

            await modLogChannel.send({ embeds: [embed] });
        } catch (error) {
            this.log('Failed to log auto-role assignment', 'error', {
                guildId: member.guild.id,
                userId: member.user.id,
                error: error.message,
            });
        }
    }

    /**
     * Get GuildInitializationService from client
     * @returns {Object|null} GuildInitializationService instance or null
     */
    getGuildInitializationService() {
        try {
            // Service is registered globally on client
            if (this.client.guildInitializationService) {
                return this.client.guildInitializationService;
            }

            // Try to get from services map if available
            if (this.client.services && this.client.services.has('GuildInitializationService')) {
                return this.client.services.get('GuildInitializationService');
            }

            return null;
        } catch (error) {
            this.log(`Error getting GuildInitializationService: ${error.message}`, 'error');
            return null;
        }
    }

    /**
     * Get GuildConfigService from client
     * @returns {Object|null} GuildConfigService instance or null
     */
    getGuildConfigService() {
        try {
            // Try to get from admin module
            const adminModule = this.client.modules?.get('admin');
            if (adminModule) {
                const service = adminModule.getService('GuildConfigService');
                if (service) {
                    return service;
                }
            }

            // Try to get from services map if available
            if (this.client.services && this.client.services.has('GuildConfigService')) {
                return this.client.services.get('GuildConfigService');
            }

            return null;
        } catch (error) {
            this.log(`Error getting GuildConfigService: ${error.message}`, 'error');
            return null;
        }
    }

    /**
     * Get error context from member
     * @param {Array} args - Event arguments
     * @returns {Object} Context object
     */
    getErrorContext(args) {
        const member = args[0];
        return {
            guild: member?.guild?.name,
            guildId: member?.guild?.id,
            user: member?.user?.tag,
            userId: member?.user?.id,
        };
    }
}

module.exports = GuildMemberAddEvent;
