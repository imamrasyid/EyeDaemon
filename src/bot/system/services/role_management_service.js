/**
 * Role Management Service
 * 
 * Handles role operations: create, delete, edit, hierarchy, auto-role, reaction-role, etc.
 */

const { Role } = require('discord.js');
const logger = require('../helpers/logger_helper');
const { DatabaseError, PermissionError } = require('../core/Errors');

class RoleManagementService {
    /**
     * Create a new RoleManagementService instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        this.client = client;
        this.database = client.database;
        this.auto_roles = new Map();
        this.reaction_roles = new Map();
        this.temporary_roles = new Map();
    }

    /**
     * Create a role
     * @param {string} guild_id - Guild ID
     * @param {Object} options - Role options
     * @returns {Promise<Role>} Created role
     */
    async create_role(guild_id, options = {}) {
        try {
            const guild = await this.client.guilds.fetch(guild_id);

            const role = await guild.roles.create({
                name: options.name || 'New Role',
                color: options.color,
                hoist: options.hoist || false,
                mentionable: options.mentionable || false,
                permissions: options.permissions,
                reason: options.reason,
            });

            logger.info(`Created role: ${role.id} in ${guild_id}`, {
                name: role.name,
            });

            return role;
        } catch (error) {
            logger.error('Failed to create role', {
                error: error.message,
                guild_id,
            });
            throw new DatabaseError('Failed to create role', {
                originalError: error.message,
            });
        }
    }

    /**
     * Delete a role
     * @param {string} guild_id - Guild ID
     * @param {string} role_id - Role ID
     * @param {string} reason - Deletion reason
     * @returns {Promise<void>}
     */
    async delete_role(guild_id, role_id, reason = null) {
        try {
            const guild = await this.client.guilds.fetch(guild_id);
            const role = await guild.roles.fetch(role_id);

            await role.delete(reason);

            logger.info(`Deleted role: ${role_id} from ${guild_id}`, { reason });
        } catch (error) {
            logger.error('Failed to delete role', {
                error: error.message,
                guild_id,
                role_id,
            });
            throw new DatabaseError('Failed to delete role', {
                originalError: error.message,
            });
        }
    }

    /**
     * Edit a role
     * @param {string} guild_id - Guild ID
     * @param {string} role_id - Role ID
     * @param {Object} options - Edit options
     * @returns {Promise<Role>} Updated role
     */
    async edit_role(guild_id, role_id, options = {}) {
        try {
            const guild = await this.client.guilds.fetch(guild_id);
            const role = await guild.roles.fetch(role_id);

            await role.edit({
                name: options.name,
                color: options.color,
                hoist: options.hoist,
                mentionable: options.mentionable,
                permissions: options.permissions,
                position: options.position,
                reason: options.reason,
            });

            logger.info(`Edited role: ${role_id} in ${guild_id}`, {
                changes: Object.keys(options),
            });

            return role;
        } catch (error) {
            logger.error('Failed to edit role', {
                error: error.message,
                guild_id,
                role_id,
            });
            throw new DatabaseError('Failed to edit role', {
                originalError: error.message,
            });
        }
    }

    /**
     * Add role to member
     * @param {string} guild_id - Guild ID
     * @param {string} user_id - User ID
     * @param {string} role_id - Role ID
     * @param {string} reason - Reason
     * @returns {Promise<void>}
     */
    async add_role_to_member(guild_id, user_id, role_id, reason = null) {
        try {
            const guild = await this.client.guilds.fetch(guild_id);
            const member = await guild.members.fetch(user_id);
            const role = await guild.roles.fetch(role_id);

            await member.roles.add(role, reason);

            logger.info(`Added role ${role_id} to member ${user_id}`, { reason });
        } catch (error) {
            logger.error('Failed to add role to member', {
                error: error.message,
                guild_id,
                user_id,
                role_id,
            });
            throw new DatabaseError('Failed to add role to member', {
                originalError: error.message,
            });
        }
    }

    /**
     * Remove role from member
     * @param {string} guild_id - Guild ID
     * @param {string} user_id - User ID
     * @param {string} role_id - Role ID
     * @param {string} reason - Reason
     * @returns {Promise<void>}
     */
    async remove_role_from_member(guild_id, user_id, role_id, reason = null) {
        try {
            const guild = await this.client.guilds.fetch(guild_id);
            const member = await guild.members.fetch(user_id);
            const role = await guild.roles.fetch(role_id);

            await member.roles.remove(role, reason);

            logger.info(`Removed role ${role_id} from member ${user_id}`, { reason });
        } catch (error) {
            logger.error('Failed to remove role from member', {
                error: error.message,
                guild_id,
                user_id,
                role_id,
            });
            throw new DatabaseError('Failed to remove role from member', {
                originalError: error.message,
            });
        }
    }

    /**
     * Set auto-role for new members
     * @param {string} guild_id - Guild ID
     * @param {string} role_id - Role ID
     * @param {boolean} enabled - Enable or disable
     * @returns {Promise<void>}
     */
    async set_auto_role(guild_id, role_id, enabled = true) {
        try {
            const key = `${guild_id}-${role_id}`;

            if (enabled) {
                this.auto_roles.set(key, {
                    guild_id,
                    role_id,
                    enabled: true,
                });
            } else {
                this.auto_roles.delete(key);
            }

            logger.info(`Set auto-role for ${guild_id}`, {
                role_id,
                enabled,
            });
        } catch (error) {
            logger.error('Failed to set auto-role', {
                error: error.message,
                guild_id,
                role_id,
            });
            throw new DatabaseError('Failed to set auto-role', {
                originalError: error.message,
            });
        }
    }

    /**
     * Get auto-roles for guild
     * @param {string} guild_id - Guild ID
     * @returns {Array} Array of role IDs
     */
    get_auto_roles(guild_id) {
        return Array.from(this.auto_roles.values())
            .filter((auto_role) => auto_role.guild_id === guild_id && auto_role.enabled)
            .map((auto_role) => auto_role.role_id);
    }

    /**
     * Apply auto-roles to member
     * @param {string} guild_id - Guild ID
     * @param {string} user_id - User ID
     * @returns {Promise<void>}
     */
    async apply_auto_roles(guild_id, user_id) {
        try {
            const auto_roles = this.get_auto_roles(guild_id);

            for (const role_id of auto_roles) {
                try {
                    await this.add_role_to_member(guild_id, user_id, role_id, 'Auto-role');
                } catch (error) {
                    logger.warn('Failed to apply auto-role', {
                        error: error.message,
                        guild_id,
                        user_id,
                        role_id,
                    });
                }
            }
        } catch (error) {
            logger.error('Failed to apply auto-roles', {
                error: error.message,
                guild_id,
                user_id,
            });
        }
    }

    /**
     * Set temporary role
     * @param {string} guild_id - Guild ID
     * @param {string} user_id - User ID
     * @param {string} role_id - Role ID
     * @param {number} duration_ms - Duration in milliseconds
     * @returns {Promise<void>}
     */
    async set_temporary_role(guild_id, user_id, role_id, duration_ms) {
        try {
            await this.add_role_to_member(guild_id, user_id, role_id, 'Temporary role');

            const key = `${guild_id}-${user_id}-${role_id}`;
            const timer = setTimeout(async () => {
                try {
                    await this.remove_role_from_member(guild_id, user_id, role_id, 'Temporary role expired');
                    this.temporary_roles.delete(key);
                } catch (error) {
                    logger.error('Failed to remove temporary role', {
                        error: error.message,
                        key,
                    });
                }
            }, duration_ms);

            this.temporary_roles.set(key, {
                guild_id,
                user_id,
                role_id,
                expires_at: Date.now() + duration_ms,
                timer,
            });

            logger.info(`Set temporary role for ${user_id}`, {
                guild_id,
                role_id,
                duration_ms,
            });
        } catch (error) {
            logger.error('Failed to set temporary role', {
                error: error.message,
                guild_id,
                user_id,
                role_id,
            });
            throw new DatabaseError('Failed to set temporary role', {
                originalError: error.message,
            });
        }
    }
}

module.exports = RoleManagementService;
