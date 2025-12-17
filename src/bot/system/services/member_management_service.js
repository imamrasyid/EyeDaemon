/**
 * Member Management Service
 * 
 * Handles member actions: kick, ban, unban, softban, timeout, nickname, pruning, voice operations
 */

const logger = require('../helpers/logger_helper');
const { DatabaseError, PermissionError } = require('../core/Errors');

class MemberManagementService {
    /**
     * Create a new MemberManagementService instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        this.client = client;
        this.database = client.database;
    }

    /**
     * Kick a member
     * @param {string} guild_id - Guild ID
     * @param {string} user_id - User ID
     * @param {string} reason - Kick reason
     * @returns {Promise<void>}
     */
    async kick_member(guild_id, user_id, reason = null) {
        try {
            const guild = await this.client.guilds.fetch(guild_id);
            const member = await guild.members.fetch(user_id);

            if (!member.kickable) {
                throw new PermissionError("I don't have permission to kick this member.");
            }

            await member.kick(reason);
            logger.info(`Kicked member: ${user_id} from ${guild_id}`, { reason });
        } catch (error) {
            logger.error('Failed to kick member', {
                error: error.message,
                guild_id,
                user_id,
            });
            throw new DatabaseError('Failed to kick member', {
                originalError: error.message,
            });
        }
    }

    /**
     * Ban a member
     * @param {string} guild_id - Guild ID
     * @param {string} user_id - User ID
     * @param {number} delete_days - Days of messages to delete (0-7)
     * @param {string} reason - Ban reason
     * @returns {Promise<void>}
     */
    async ban_member(guild_id, user_id, delete_days = 0, reason = null) {
        try {
            const guild = await this.client.guilds.fetch(guild_id);
            const member = await guild.members.fetch(user_id).catch(() => null);

            if (member && !member.bannable) {
                throw new PermissionError("I don't have permission to ban this member.");
            }

            await guild.members.ban(user_id, {
                deleteMessageDays: Math.max(0, Math.min(7, delete_days)),
                reason,
            });

            logger.info(`Banned member: ${user_id} from ${guild_id}`, {
                delete_days,
                reason,
            });
        } catch (error) {
            logger.error('Failed to ban member', {
                error: error.message,
                guild_id,
                user_id,
            });
            throw new DatabaseError('Failed to ban member', {
                originalError: error.message,
            });
        }
    }

    /**
     * Unban a user
     * @param {string} guild_id - Guild ID
     * @param {string} user_id - User ID
     * @param {string} reason - Unban reason
     * @returns {Promise<void>}
     */
    async unban_member(guild_id, user_id, reason = null) {
        try {
            const guild = await this.client.guilds.fetch(guild_id);
            await guild.members.unban(user_id, reason);

            logger.info(`Unbanned user: ${user_id} from ${guild_id}`, { reason });
        } catch (error) {
            logger.error('Failed to unban member', {
                error: error.message,
                guild_id,
                user_id,
            });
            throw new DatabaseError('Failed to unban member', {
                originalError: error.message,
            });
        }
    }

    /**
     * Softban a member (ban then unban)
     * @param {string} guild_id - Guild ID
     * @param {string} user_id - User ID
     * @param {number} delete_days - Days of messages to delete
     * @param {string} reason - Softban reason
     * @returns {Promise<void>}
     */
    async softban_member(guild_id, user_id, delete_days = 1, reason = null) {
        try {
            await this.ban_member(guild_id, user_id, delete_days, reason);
            await this.unban_member(guild_id, user_id, 'Softban - automatic unban');

            logger.info(`Softbanned member: ${user_id} from ${guild_id}`, {
                delete_days,
                reason,
            });
        } catch (error) {
            logger.error('Failed to softban member', {
                error: error.message,
                guild_id,
                user_id,
            });
            throw new DatabaseError('Failed to softban member', {
                originalError: error.message,
            });
        }
    }

    /**
     * Timeout a member
     * @param {string} guild_id - Guild ID
     * @param {string} user_id - User ID
     * @param {number} duration_ms - Timeout duration in milliseconds
     * @param {string} reason - Timeout reason
     * @returns {Promise<void>}
     */
    async timeout_member(guild_id, user_id, duration_ms, reason = null) {
        try {
            const guild = await this.client.guilds.fetch(guild_id);
            const member = await guild.members.fetch(user_id);

            if (!member.moderatable) {
                throw new PermissionError("I don't have permission to timeout this member.");
            }

            const timeout_until = new Date(Date.now() + duration_ms);
            await member.timeout(timeout_until, reason);

            logger.info(`Timed out member: ${user_id} from ${guild_id}`, {
                duration_ms,
                timeout_until,
                reason,
            });
        } catch (error) {
            logger.error('Failed to timeout member', {
                error: error.message,
                guild_id,
                user_id,
            });
            throw new DatabaseError('Failed to timeout member', {
                originalError: error.message,
            });
        }
    }

    /**
     * Remove timeout from member
     * @param {string} guild_id - Guild ID
     * @param {string} user_id - User ID
     * @param {string} reason - Reason
     * @returns {Promise<void>}
     */
    async remove_timeout(guild_id, user_id, reason = null) {
        try {
            const guild = await this.client.guilds.fetch(guild_id);
            const member = await guild.members.fetch(user_id);

            await member.timeout(null, reason);

            logger.info(`Removed timeout from member: ${user_id} from ${guild_id}`, {
                reason,
            });
        } catch (error) {
            logger.error('Failed to remove timeout', {
                error: error.message,
                guild_id,
                user_id,
            });
            throw new DatabaseError('Failed to remove timeout', {
                originalError: error.message,
            });
        }
    }

    /**
     * Change member nickname
     * @param {string} guild_id - Guild ID
     * @param {string} user_id - User ID
     * @param {string} nickname - New nickname (null to reset)
     * @param {string} reason - Reason
     * @returns {Promise<void>}
     */
    async change_nickname(guild_id, user_id, nickname, reason = null) {
        try {
            const guild = await this.client.guilds.fetch(guild_id);
            const member = await guild.members.fetch(user_id);

            if (!member.moderatable) {
                throw new PermissionError("I don't have permission to change this member's nickname.");
            }

            await member.setNickname(nickname, reason);

            logger.info(`Changed nickname for member: ${user_id} from ${guild_id}`, {
                nickname,
                reason,
            });
        } catch (error) {
            logger.error('Failed to change nickname', {
                error: error.message,
                guild_id,
                user_id,
            });
            throw new DatabaseError('Failed to change nickname', {
                originalError: error.message,
            });
        }
    }

    /**
     * Prune members (kick inactive members)
     * @param {string} guild_id - Guild ID
     * @param {number} days - Days of inactivity
     * @param {boolean} dry_run - If true, only count members without kicking
     * @param {Array<string>} roles - Roles to exclude from pruning
     * @returns {Promise<number>} Number of members pruned or would be pruned
     */
    async prune_members(guild_id, days, dry_run = false, roles = []) {
        try {
            const guild = await this.client.guilds.fetch(guild_id);
            const prune_count = await guild.members.prune({
                days,
                dryRun: dry_run,
                roles,
            });

            logger.info(`Pruned members from ${guild_id}`, {
                days,
                dry_run,
                count: prune_count,
            });

            return prune_count;
        } catch (error) {
            logger.error('Failed to prune members', {
                error: error.message,
                guild_id,
                days,
            });
            throw new DatabaseError('Failed to prune members', {
                originalError: error.message,
            });
        }
    }

    /**
     * Move member to voice channel
     * @param {string} guild_id - Guild ID
     * @param {string} user_id - User ID
     * @param {string} channel_id - Target voice channel ID
     * @param {string} reason - Reason
     * @returns {Promise<void>}
     */
    async move_to_voice_channel(guild_id, user_id, channel_id, reason = null) {
        try {
            const guild = await this.client.guilds.fetch(guild_id);
            const member = await guild.members.fetch(user_id);
            const channel = await guild.channels.fetch(channel_id);

            if (channel.type !== 2) {
                // Voice channel type
                throw new Error('Target channel must be a voice channel');
            }

            await member.voice.setChannel(channel, reason);

            logger.info(`Moved member ${user_id} to voice channel ${channel_id}`, {
                reason,
            });
        } catch (error) {
            logger.error('Failed to move member to voice channel', {
                error: error.message,
                guild_id,
                user_id,
                channel_id,
            });
            throw new DatabaseError('Failed to move member to voice channel', {
                originalError: error.message,
            });
        }
    }

    /**
     * Disconnect member from voice
     * @param {string} guild_id - Guild ID
     * @param {string} user_id - User ID
     * @param {string} reason - Reason
     * @returns {Promise<void>}
     */
    async disconnect_from_voice(guild_id, user_id, reason = null) {
        try {
            const guild = await this.client.guilds.fetch(guild_id);
            const member = await guild.members.fetch(user_id);

            await member.voice.setChannel(null, reason);

            logger.info(`Disconnected member ${user_id} from voice`, { reason });
        } catch (error) {
            logger.error('Failed to disconnect member from voice', {
                error: error.message,
                guild_id,
                user_id,
            });
            throw new DatabaseError('Failed to disconnect member from voice', {
                originalError: error.message,
            });
        }
    }
}

module.exports = MemberManagementService;
