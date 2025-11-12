const { PermissionFlagsBits } = require('discord.js');
const { permissions: logger } = require('../services/logging.service');

/**
 * Permission Manager untuk granular permission system
 */
class PermissionManager {
  constructor(client) {
    this.client = client;
    this.permissions = new Map();
    this.rolePermissions = new Map();
    this.userPermissions = new Map();
    this.guildSettings = new Map();
    this.enabled = true;
  }

  /**
   * Initialize permission manager
   */
  async initialize() {
    logger.info('Initializing permission manager');
    
    // Load default permissions
    await this.loadDefaultPermissions();
    
    // Load permissions from database
    await this.loadPermissionsFromDatabase();
    
    logger.info('Permission manager initialized successfully');
  }

  /**
   * Load default permission definitions
   */
  async loadDefaultPermissions() {
    // Define default permissions for different roles
    const defaultPermissions = {
      // Server Owner - All permissions
      owner: [
        'admin', 'manage_server', 'manage_modules', 'manage_settings',
        'moderation.ban', 'moderation.kick', 'moderation.warn', 'moderation.mute',
        'economy.manage', 'economy.reset', 'economy.give', 'economy.take',
        'music.manage', 'music.priority', 'music.skip', 'music.stop',
        'leveling.manage', 'leveling.reset', 'leveling.give_xp', 'leveling.take_xp',
        'tickets.manage', 'tickets.close', 'tickets.assign',
        'logging.view', 'logging.manage', 'logging.delete'
      ],

      // Administrator - Most permissions
      administrator: [
        'moderation.ban', 'moderation.kick', 'moderation.warn', 'moderation.mute',
        'economy.manage', 'economy.give', 'economy.take',
        'music.manage', 'music.skip', 'music.stop',
        'leveling.manage', 'leveling.give_xp', 'leveling.take_xp',
        'tickets.manage', 'tickets.close', 'tickets.assign',
        'logging.view', 'logging.manage'
      ],

      // Moderator - Basic moderation
      moderator: [
        'moderation.kick', 'moderation.warn', 'moderation.mute',
        'tickets.manage', 'tickets.close',
        'logging.view'
      ],

      // Premium Member - Enhanced features
      premium: [
        'music.priority', 'music.skip',
        'economy.daily_bonus', 'economy.work_bonus',
        'leveling.xp_bonus', 'leveling.priority'
      ],

      // Regular Member - Basic permissions
      member: [
        'music.play', 'music.queue', 'music.playlist',
        'economy.balance', 'economy.transfer', 'economy.daily', 'economy.work',
        'leveling.rank', 'leveling.leaderboard',
        'tickets.create', 'tickets.view',
        'logging.view_own'
      ]
    };

    // Store default permissions
    for (const [role, perms] of Object.entries(defaultPermissions)) {
      this.permissions.set(role, perms);
    }

    logger.debug('Default permissions loaded');
  }

  /**
   * Load permissions from database
   */
  async loadPermissionsFromDatabase() {
    try {
      const database = this.client.database;
      if (!database) {
        logger.warn('Database not available for permission loading');
        return;
      }

      // Load role permissions
      const rolePerms = await database.all('SELECT * FROM role_permissions');
      for (const perm of rolePerms) {
        const key = `${perm.guild_id}.${perm.role_id}`;
        if (!this.rolePermissions.has(key)) {
          this.rolePermissions.set(key, new Set());
        }
        this.rolePermissions.get(key).add(perm.permission);
      }

      // Load user permissions
      const userPerms = await database.all('SELECT * FROM user_permissions');
      for (const perm of userPerms) {
        const key = `${perm.guild_id}.${perm.user_id}`;
        if (!this.userPermissions.has(key)) {
          this.userPermissions.set(key, new Set());
        }
        this.userPermissions.get(key).add(perm.permission);
      }

      // Load guild settings
      const guildSettings = await database.all('SELECT * FROM guild_settings WHERE key = ?', ['permissions']);
      for (const setting of guildSettings) {
        try {
          const settings = JSON.parse(setting.value);
          this.guildSettings.set(setting.guild_id, settings);
        } catch (error) {
          logger.error(`Failed to parse guild settings for ${setting.guild_id}`, { error: error.message });
        }
      }

      logger.debug('Permissions loaded from database');
    } catch (error) {
      logger.error('Failed to load permissions from database', { error: error.message });
    }
  }

  /**
   * Check if user has permission
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @param {string} permission - Permission to check
   * @param {Object} options - Additional options
   * @returns {boolean}
   */
  async hasPermission(userId, guildId, permission, options = {}) {
    try {
      // Check if permission manager is enabled
      if (!this.enabled) {
        logger.warn('Permission manager is disabled, allowing all permissions');
        return true;
      }

      // Get guild member
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        logger.warn(`Guild ${guildId} not found for permission check`);
        return false;
      }

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        logger.warn(`Member ${userId} not found in guild ${guildId}`);
        return false;
      }

      // Check if user is guild owner
      if (member.id === guild.ownerId) {
        return true;
      }

      // Check user-specific permissions
      const userKey = `${guildId}.${userId}`;
      if (this.userPermissions.has(userKey)) {
        const userPerms = this.userPermissions.get(userKey);
        if (userPerms.has('admin') || userPerms.has(permission)) {
          return true;
        }
      }

      // Check role-based permissions
      for (const role of member.roles.cache.values()) {
        const roleKey = `${guildId}.${role.id}`;
        if (this.rolePermissions.has(roleKey)) {
          const rolePerms = this.rolePermissions.get(roleKey);
          if (rolePerms.has('admin') || rolePerms.has(permission)) {
            return true;
          }
        }
      }

      // Check default role permissions
      const defaultRole = this.getDefaultRole(member);
      if (defaultRole && this.permissions.has(defaultRole)) {
        const defaultPerms = this.permissions.get(defaultRole);
        if (defaultPerms.includes('admin') || defaultPerms.includes(permission)) {
          return true;
        }
      }

      // Check guild-specific overrides
      const guildSettings = this.guildSettings.get(guildId);
      if (guildSettings && guildSettings.permissionOverrides) {
        const overrides = guildSettings.permissionOverrides;
        
        // Check user overrides
        if (overrides.users && overrides.users[userId]) {
          const userOverrides = overrides.users[userId];
          if (userOverrides.includes('admin') || userOverrides.includes(permission)) {
            return true;
          }
        }

        // Check role overrides
        if (overrides.roles) {
          for (const roleId of member.roles.cache.keys()) {
            if (overrides.roles[roleId]) {
              const roleOverrides = overrides.roles[roleId];
              if (roleOverrides.includes('admin') || roleOverrides.includes(permission)) {
                return true;
              }
            }
          }
        }
      }

      // Permission denied
      logger.debug(`Permission denied: ${userId} does not have ${permission} in ${guildId}`);
      return false;

    } catch (error) {
      logger.error(`Error checking permission ${permission} for user ${userId} in guild ${guildId}`, { error: error.message });
      return false;
    }
  }

  /**
   * Get default role for member
   * @param {GuildMember} member - Guild member
   * @returns {string|null}
   */
  getDefaultRole(member) {
    // Check if member has administrator permission
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      return 'administrator';
    }

    // Check if member has moderation permissions
    if (member.permissions.has(PermissionFlagsBits.KickMembers) || 
        member.permissions.has(PermissionFlagsBits.BanMembers) ||
        member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return 'moderator';
    }

    // Check for premium role (custom implementation needed)
    // This would need to be configured per guild
    
    return 'member';
  }

  /**
   * Grant permission to user
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @param {string} permission - Permission to grant
   */
  async grantUserPermission(userId, guildId, permission) {
    try {
      const userKey = `${guildId}.${userId}`;
      if (!this.userPermissions.has(userKey)) {
        this.userPermissions.set(userKey, new Set());
      }
      
      this.userPermissions.get(userKey).add(permission);

      // Save to database
      const database = this.client.database;
      if (database) {
        await database.query(
          'INSERT OR REPLACE INTO user_permissions (guild_id, user_id, permission) VALUES (?, ?, ?)',
          [guildId, userId, permission]
        );
      }

      logger.info(`Granted permission ${permission} to user ${userId} in guild ${guildId}`);
    } catch (error) {
      logger.error(`Failed to grant permission ${permission} to user ${userId} in guild ${guildId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Revoke permission from user
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @param {string} permission - Permission to revoke
   */
  async revokeUserPermission(userId, guildId, permission) {
    try {
      const userKey = `${guildId}.${userId}`;
      if (this.userPermissions.has(userKey)) {
        this.userPermissions.get(userKey).delete(permission);
      }

      // Remove from database
      const database = this.client.database;
      if (database) {
        await database.query(
          'DELETE FROM user_permissions WHERE guild_id = ? AND user_id = ? AND permission = ?',
          [guildId, userId, permission]
        );
      }

      logger.info(`Revoked permission ${permission} from user ${userId} in guild ${guildId}`);
    } catch (error) {
      logger.error(`Failed to revoke permission ${permission} from user ${userId} in guild ${guildId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Grant permission to role
   * @param {string} roleId - Role ID
   * @param {string} guildId - Guild ID
   * @param {string} permission - Permission to grant
   */
  async grantRolePermission(roleId, guildId, permission) {
    try {
      const roleKey = `${guildId}.${roleId}`;
      if (!this.rolePermissions.has(roleKey)) {
        this.rolePermissions.set(roleKey, new Set());
      }
      
      this.rolePermissions.get(roleKey).add(permission);

      // Save to database
      const database = this.client.database;
      if (database) {
        await database.query(
          'INSERT OR REPLACE INTO role_permissions (guild_id, role_id, permission) VALUES (?, ?, ?)',
          [guildId, roleId, permission]
        );
      }

      logger.info(`Granted permission ${permission} to role ${roleId} in guild ${guildId}`);
    } catch (error) {
      logger.error(`Failed to grant permission ${permission} to role ${roleId} in guild ${guildId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Revoke permission from role
   * @param {string} roleId - Role ID
   * @param {string} guildId - Guild ID
   * @param {string} permission - Permission to revoke
   */
  async revokeRolePermission(roleId, guildId, permission) {
    try {
      const roleKey = `${guildId}.${roleId}`;
      if (this.rolePermissions.has(roleKey)) {
        this.rolePermissions.get(roleKey).delete(permission);
      }

      // Remove from database
      const database = this.client.database;
      if (database) {
        await database.query(
          'DELETE FROM role_permissions WHERE guild_id = ? AND role_id = ? AND permission = ?',
          [guildId, roleId, permission]
        );
      }

      logger.info(`Revoked permission ${permission} from role ${roleId} in guild ${guildId}`);
    } catch (error) {
      logger.error(`Failed to revoke permission ${permission} from role ${roleId} in guild ${guildId}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Get user permissions
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @returns {Array} User permissions
   */
  async getUserPermissions(userId, guildId) {
    try {
      const permissions = new Set();

      // Get guild member
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) return [];

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return [];

      // Check if user is guild owner
      if (member.id === guild.ownerId) {
        return Array.from(this.permissions.get('owner') || []);
      }

      // Add user-specific permissions
      const userKey = `${guildId}.${userId}`;
      if (this.userPermissions.has(userKey)) {
        this.userPermissions.get(userKey).forEach(perm => permissions.add(perm));
      }

      // Add role-based permissions
      for (const role of member.roles.cache.values()) {
        const roleKey = `${guildId}.${role.id}`;
        if (this.rolePermissions.has(roleKey)) {
          this.rolePermissions.get(roleKey).forEach(perm => permissions.add(perm));
        }
      }

      // Add default role permissions
      const defaultRole = this.getDefaultRole(member);
      if (defaultRole && this.permissions.has(defaultRole)) {
        const defaultPerms = this.permissions.get(defaultRole);
        defaultPerms.forEach(perm => permissions.add(perm));
      }

      return Array.from(permissions);
    } catch (error) {
      logger.error(`Failed to get permissions for user ${userId} in guild ${guildId}`, { error: error.message });
      return [];
    }
  }

  /**
   * Get permission manager status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      totalPermissions: this.permissions.size,
      totalRolePermissions: this.rolePermissions.size,
      totalUserPermissions: this.userPermissions.size,
      totalGuildSettings: this.guildSettings.size,
      enabled: this.enabled
    };
  }

  /**
   * Enable permission manager
   */
  enable() {
    this.enabled = true;
    logger.info('Permission manager enabled');
  }

  /**
   * Disable permission manager
   */
  disable() {
    this.enabled = false;
    logger.warn('Permission manager disabled - all permissions will be granted');
  }
}

module.exports = PermissionManager;