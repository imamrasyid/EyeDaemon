/**
 * ModerationService
 * 
 * Business logic for moderation actions including bans, kicks, mutes, timeouts, and warnings.
 * Handles DM notifications and moderation logging.
 */

const BaseService = require('../../../system/core/BaseService');
const { EmbedBuilder } = require('discord.js');

class ModerationService extends BaseService {
    /**
     * Create a new ModerationService instance
     * @param {Object} client - Discord client instance
     * @param {Object} options - Service configuration options
     */
    constructor(client, options = {}) {
        super(client, options);

        // Will be set during initialization
        this.moderationModel = null;
        this.infractionService = null;
        this.guildConfigService = null;
    }

    /**
     * Initialize service with dependencies
     * @returns {Promise<void>}
     */
    async initialize() {
        await super.initialize();

        // Get model from loader
        const loader = this.client.loader;
        if (loader) {
            this.moderationModel = loader.model('ModerationModel');
        }

        // Get GuildConfigService from admin module
        const adminModule = this.client.modules.get('admin');
        if (adminModule) {
            this.guildConfigService = adminModule.getService('GuildConfigService');
        }

        this.log('ModerationService initialized', 'info');
    }

    /**
     * Set InfractionService reference (called after all services are loaded)
     * @param {Object} infractionService - InfractionService instance
     */
    setInfractionService(infractionService) {
        this.infractionService = infractionService;
    }

    /**
     * Ban a member from the guild
     * @param {Object} guild - Discord guild
     * @param {Object} target - Target user object
     * @param {Object} moderator - Moderator user object
     * @param {string} reason - Ban reason
     * @param {number} deleteMessageDays - Days of messages to delete (0-7)
     * @returns {Promise<Object>} Result object with success status
     */
    async banMember(guild, target, moderator, reason = 'No reason provided', deleteMessageDays = 0) {
        try {
            this.validateRequired({ guild, target, moderator }, ['guild', 'target', 'moderator']);

            // Check if target is a member
            const member = await guild.members.fetch(target.id).catch(() => null);

            // Check if member is bannable
            if (member && !member.bannable) {
                return {
                    success: false,
                    error: 'Cannot ban this user (insufficient permissions or role hierarchy)'
                };
            }

            // Send DM before banning
            await this.sendModDM(target, guild, 'banned', reason);

            // Execute ban
            await guild.members.ban(target.id, {
                reason: `${moderator.tag}: ${reason}`,
                deleteMessageSeconds: deleteMessageDays * 86400
            });

            // Create infraction record
            if (this.infractionService) {
                await this.infractionService.createInfraction({
                    guildId: guild.id,
                    userId: target.id,
                    moderatorId: moderator.id,
                    type: 'ban',
                    reason: reason
                });
            }

            // Log to moderation channel
            await this.logModeration(guild, 'ban', target, moderator, reason);

            this.log(`User ${target.id} banned from guild ${guild.id} by ${moderator.id}`, 'info');

            return { success: true };
        } catch (error) {
            this.handleError(error, 'banMember', { guildId: guild.id, targetId: target.id });
            return { success: false, error: error.message };
        }
    }

    /**
     * Unban a user from the guild
     * @param {Object} guild - Discord guild
     * @param {string} userId - User ID to unban
     * @param {Object} moderator - Moderator user object
     * @param {string} reason - Unban reason
     * @returns {Promise<Object>} Result object with success status
     */
    async unbanMember(guild, userId, moderator, reason = 'No reason provided') {
        try {
            this.validateRequired({ guild, userId, moderator }, ['guild', 'userId', 'moderator']);

            // Check if user is banned
            const bans = await guild.bans.fetch();
            const bannedUser = bans.get(userId);

            if (!bannedUser) {
                return {
                    success: false,
                    error: 'This user is not banned'
                };
            }

            // Execute unban
            await guild.members.unban(userId, `${moderator.tag}: ${reason}`);

            // Create infraction record
            if (this.infractionService) {
                await this.infractionService.createInfraction({
                    guildId: guild.id,
                    userId: userId,
                    moderatorId: moderator.id,
                    type: 'unban',
                    reason: reason
                });
            }

            // Log to moderation channel
            await this.logModeration(guild, 'unban', bannedUser.user, moderator, reason);

            this.log(`User ${userId} unbanned from guild ${guild.id} by ${moderator.id}`, 'info');

            return { success: true, user: bannedUser.user };
        } catch (error) {
            this.handleError(error, 'unbanMember', { guildId: guild.id, userId });
            return { success: false, error: error.message };
        }
    }

    /**
     * Kick a member from the guild
     * @param {Object} guild - Discord guild
     * @param {Object} member - Target member object
     * @param {Object} moderator - Moderator user object
     * @param {string} reason - Kick reason
     * @returns {Promise<Object>} Result object with success status
     */
    async kickMember(guild, member, moderator, reason = 'No reason provided') {
        try {
            this.validateRequired({ guild, member, moderator }, ['guild', 'member', 'moderator']);

            // Check if member is kickable
            if (!member.kickable) {
                return {
                    success: false,
                    error: 'Cannot kick this user (insufficient permissions or role hierarchy)'
                };
            }

            // Send DM before kicking
            await this.sendModDM(member.user, guild, 'kicked', reason);

            // Execute kick
            await member.kick(`${moderator.tag}: ${reason}`);

            // Create infraction record
            if (this.infractionService) {
                await this.infractionService.createInfraction({
                    guildId: guild.id,
                    userId: member.user.id,
                    moderatorId: moderator.id,
                    type: 'kick',
                    reason: reason
                });
            }

            // Log to moderation channel
            await this.logModeration(guild, 'kick', member.user, moderator, reason);

            this.log(`User ${member.user.id} kicked from guild ${guild.id} by ${moderator.id}`, 'info');

            return { success: true };
        } catch (error) {
            this.handleError(error, 'kickMember', { guildId: guild.id, memberId: member.user.id });
            return { success: false, error: error.message };
        }
    }

    /**
     * Mute a member (legacy mute using role)
     * @param {Object} guild - Discord guild
     * @param {Object} member - Target member object
     * @param {Object} moderator - Moderator user object
     * @param {string} reason - Mute reason
     * @param {string} muteRoleId - Mute role ID
     * @returns {Promise<Object>} Result object with success status
     */
    async muteMember(guild, member, moderator, reason = 'No reason provided', muteRoleId = null) {
        try {
            this.validateRequired({ guild, member, moderator }, ['guild', 'member', 'moderator']);

            // Get mute role
            let muteRole;
            if (muteRoleId) {
                muteRole = guild.roles.cache.get(muteRoleId);
            } else {
                // Try to find a role named "Muted"
                muteRole = guild.roles.cache.find(role => role.name.toLowerCase() === 'muted');
            }

            if (!muteRole) {
                return {
                    success: false,
                    error: 'Mute role not found. Please configure a mute role.'
                };
            }

            // Check if member already has mute role
            if (member.roles.cache.has(muteRole.id)) {
                return {
                    success: false,
                    error: 'User is already muted'
                };
            }

            // Send DM before muting
            await this.sendModDM(member.user, guild, 'muted', reason);

            // Add mute role
            await member.roles.add(muteRole, `${moderator.tag}: ${reason}`);

            // Create infraction record
            if (this.infractionService) {
                await this.infractionService.createInfraction({
                    guildId: guild.id,
                    userId: member.user.id,
                    moderatorId: moderator.id,
                    type: 'mute',
                    reason: reason
                });
            }

            // Log to moderation channel
            await this.logModeration(guild, 'mute', member.user, moderator, reason);

            this.log(`User ${member.user.id} muted in guild ${guild.id} by ${moderator.id}`, 'info');

            return { success: true };
        } catch (error) {
            this.handleError(error, 'muteMember', { guildId: guild.id, memberId: member.user.id });
            return { success: false, error: error.message };
        }
    }

    /**
     * Unmute a member (remove mute role)
     * @param {Object} guild - Discord guild
     * @param {Object} member - Target member object
     * @param {Object} moderator - Moderator user object
     * @param {string} reason - Unmute reason
     * @param {string} muteRoleId - Mute role ID
     * @returns {Promise<Object>} Result object with success status
     */
    async unmuteMember(guild, member, moderator, reason = 'No reason provided', muteRoleId = null) {
        try {
            this.validateRequired({ guild, member, moderator }, ['guild', 'member', 'moderator']);

            // Get mute role
            let muteRole;
            if (muteRoleId) {
                muteRole = guild.roles.cache.get(muteRoleId);
            } else {
                muteRole = guild.roles.cache.find(role => role.name.toLowerCase() === 'muted');
            }

            if (!muteRole) {
                return {
                    success: false,
                    error: 'Mute role not found'
                };
            }

            // Check if member has mute role
            if (!member.roles.cache.has(muteRole.id)) {
                return {
                    success: false,
                    error: 'User is not muted'
                };
            }

            // Remove mute role
            await member.roles.remove(muteRole, `${moderator.tag}: ${reason}`);

            // Create infraction record
            if (this.infractionService) {
                await this.infractionService.createInfraction({
                    guildId: guild.id,
                    userId: member.user.id,
                    moderatorId: moderator.id,
                    type: 'unmute',
                    reason: reason
                });
            }

            // Log to moderation channel
            await this.logModeration(guild, 'unmute', member.user, moderator, reason);

            this.log(`User ${member.user.id} unmuted in guild ${guild.id} by ${moderator.id}`, 'info');

            return { success: true };
        } catch (error) {
            this.handleError(error, 'unmuteMember', { guildId: guild.id, memberId: member.user.id });
            return { success: false, error: error.message };
        }
    }

    /**
     * Timeout a member (Discord native timeout)
     * @param {Object} guild - Discord guild
     * @param {Object} member - Target member object
     * @param {Object} moderator - Moderator user object
     * @param {number} duration - Duration in minutes
     * @param {string} reason - Timeout reason
     * @returns {Promise<Object>} Result object with success status
     */
    async timeoutMember(guild, member, moderator, duration, reason = 'No reason provided') {
        try {
            this.validateRequired({ guild, member, moderator, duration }, ['guild', 'member', 'moderator', 'duration']);

            // Check if member is moderatable
            if (!member.moderatable) {
                return {
                    success: false,
                    error: 'Cannot timeout this user (insufficient permissions or role hierarchy)'
                };
            }

            // Validate duration (1 minute to 28 days)
            if (duration < 1 || duration > 40320) {
                return {
                    success: false,
                    error: 'Duration must be between 1 minute and 28 days (40320 minutes)'
                };
            }

            // Send DM before timeout
            await this.sendModDM(member.user, guild, 'timed out', reason, { duration });

            // Execute timeout
            await member.timeout(duration * 60 * 1000, `${moderator.tag}: ${reason}`);

            // Create infraction record
            if (this.infractionService) {
                await this.infractionService.createInfraction({
                    guildId: guild.id,
                    userId: member.user.id,
                    moderatorId: moderator.id,
                    type: 'timeout',
                    reason: reason,
                    duration: duration
                });
            }

            // Log to moderation channel
            await this.logModeration(guild, 'timeout', member.user, moderator, reason, { duration });

            this.log(`User ${member.user.id} timed out in guild ${guild.id} by ${moderator.id} for ${duration} minutes`, 'info');

            return { success: true };
        } catch (error) {
            this.handleError(error, 'timeoutMember', { guildId: guild.id, memberId: member.user.id });
            return { success: false, error: error.message };
        }
    }

    /**
     * Warn a member
     * @param {Object} guild - Discord guild
     * @param {Object} user - Target user object
     * @param {Object} moderator - Moderator user object
     * @param {string} reason - Warning reason
     * @returns {Promise<Object>} Result object with success status and warning data
     */
    async warnMember(guild, user, moderator, reason = 'No reason provided') {
        try {
            this.validateRequired({ guild, user, moderator }, ['guild', 'user', 'moderator']);

            // Check if user is a bot
            if (user.bot) {
                return {
                    success: false,
                    error: 'Cannot warn bots'
                };
            }

            // Check if user is trying to warn themselves
            if (user.id === moderator.id) {
                return {
                    success: false,
                    error: 'You cannot warn yourself'
                };
            }

            // Send DM
            await this.sendModDM(user, guild, 'warned', reason);

            // Create warning via model
            const warning = await this.moderationModel.addWarning(
                user.id,
                guild.id,
                moderator.id,
                reason
            );

            // Create infraction record
            if (this.infractionService) {
                await this.infractionService.createInfraction({
                    guildId: guild.id,
                    userId: user.id,
                    moderatorId: moderator.id,
                    type: 'warning',
                    reason: reason
                });
            }

            // Log to moderation channel
            await this.logModeration(guild, 'warn', user, moderator, reason);

            this.log(`User ${user.id} warned in guild ${guild.id} by ${moderator.id}`, 'info');

            return { success: true, warning };
        } catch (error) {
            this.handleError(error, 'warnMember', { guildId: guild.id, userId: user.id });
            return { success: false, error: error.message };
        }
    }

    /**
     * Remove a warning
     * @param {string} warningId - Warning ID
     * @returns {Promise<Object>} Result object with success status
     */
    async removeWarn(warningId) {
        try {
            this.validateRequired({ warningId }, ['warningId']);

            await this.moderationModel.removeWarning(warningId);

            this.log(`Warning ${warningId} removed`, 'info');

            return { success: true };
        } catch (error) {
            this.handleError(error, 'removeWarn', { warningId });
            return { success: false, error: error.message };
        }
    }

    /**
     * Get warnings for a user
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {Promise<Array>} Array of warnings
     */
    async getWarnings(userId, guildId) {
        try {
            this.validateRequired({ userId, guildId }, ['userId', 'guildId']);

            const warnings = await this.moderationModel.getWarnings(userId, guildId);

            return warnings || [];
        } catch (error) {
            this.handleError(error, 'getWarnings', { userId, guildId });
            return [];
        }
    }

    /**
     * Send DM to user about moderation action
     * @param {Object} user - Target user object
     * @param {Object} guild - Discord guild
     * @param {string} action - Action type (banned, kicked, warned, etc.)
     * @param {string} reason - Action reason
     * @param {Object} extra - Extra information (e.g., duration)
     * @returns {Promise<boolean>} True if DM sent successfully
     */
    async sendModDM(user, guild, action, reason, extra = {}) {
        try {
            let message = `You have been **${action}** in **${guild.name}**\n**Reason:** ${reason}`;

            if (extra.duration) {
                message += `\n**Duration:** ${extra.duration} minutes`;
            }

            await user.send(message);
            return true;
        } catch (error) {
            // User might have DMs disabled
            this.log(`Could not send DM to user ${user.id}: ${error.message}`, 'warn');
            return false;
        }
    }

    /**
     * Log moderation action to configured channel
     * @param {Object} guild - Discord guild
     * @param {string} action - Action type (warn, kick, ban, etc.)
     * @param {Object} target - Target user
     * @param {Object} moderator - Moderator user
     * @param {string} reason - Reason for action
     * @param {Object} extra - Extra information (e.g., duration)
     * @returns {Promise<boolean>} True if logged successfully
     */
    async logModeration(guild, action, target, moderator, reason, extra = {}) {
        try {
            if (!this.guildConfigService) {
                return false;
            }

            const logChannelId = await this.guildConfigService.getSetting(guild.id, 'moderation_log_channel');

            if (!logChannelId) {
                return false;
            }

            const logChannel = guild.channels.cache.get(logChannelId);

            if (!logChannel) {
                this.log(`Moderation log channel ${logChannelId} not found`, 'warn');
                return false;
            }

            // Check if bot has permissions to send messages
            const permissions = logChannel.permissionsFor(guild.members.me);
            if (!permissions || !permissions.has('SendMessages')) {
                this.log(`No permission to send messages in moderation log channel`, 'warn');
                return false;
            }

            const actionColors = {
                warn: 0xe67e22,
                kick: 0xe74c3c,
                ban: 0xc0392b,
                unban: 0x2ecc71,
                timeout: 0x95a5a6,
                mute: 0x95a5a6,
                unmute: 0x2ecc71,
            };

            const actionEmojis = {
                warn: '⚠️',
                kick: '👢',
                ban: '🔨',
                unban: '✅',
                timeout: '⏱️',
                mute: '🔇',
                unmute: '🔊',
            };

            const embed = new EmbedBuilder()
                .setColor(actionColors[action] || 0x95a5a6)
                .setTitle(`${actionEmojis[action] || '📋'} Moderation Action: ${action.toUpperCase()}`)
                .addFields(
                    { name: 'Target', value: `${target.tag} (${target.id})`, inline: true },
                    { name: 'Moderator', value: `${moderator.tag} (${moderator.id})`, inline: true },
                    { name: 'Reason', value: reason || 'No reason provided' }
                )
                .setTimestamp();

            if (extra.duration) {
                embed.addFields({ name: 'Duration', value: `${extra.duration} minutes` });
            }

            await logChannel.send({ embeds: [embed] });
            return true;
        } catch (error) {
            this.log(`Error logging moderation action: ${error.message}`, 'warn');
            return false;
        }
    }
}

module.exports = ModerationService;
