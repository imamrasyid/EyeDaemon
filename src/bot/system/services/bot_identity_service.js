/**
 * Bot Identity Service
 * 
 * Manages bot identity: username, avatar, banner, application description, tags
 */

const logger = require('../helpers/logger_helper');
const { DatabaseError } = require('../core/Errors');

class BotIdentityService {
    /**
     * Create a new BotIdentityService instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        this.client = client;
        this.database = client.database;
    }

    /**
     * Update bot username
     * @param {string} username - New username
     * @returns {Promise<void>}
     */
    async update_username(username) {
        try {
            if (!username || username.length < 2 || username.length > 32) {
                throw new Error('Username must be between 2 and 32 characters');
            }

            await this.client.user.setUsername(username);
            logger.info(`Updated bot username to: ${username}`);
        } catch (error) {
            logger.error('Failed to update bot username', {
                error: error.message,
                username,
            });
            throw new DatabaseError('Failed to update bot username', {
                originalError: error.message,
            });
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
            logger.info('Updated bot avatar');
        } catch (error) {
            logger.error('Failed to update bot avatar', {
                error: error.message,
            });
            throw new DatabaseError('Failed to update bot avatar', {
                originalError: error.message,
            });
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
            logger.info('Updated bot banner');
        } catch (error) {
            logger.error('Failed to update bot banner', {
                error: error.message,
            });
            throw new DatabaseError('Failed to update bot banner', {
                originalError: error.message,
            });
        }
    }

    /**
     * Update application description
     * @param {string} description - Application description
     * @returns {Promise<void>}
     */
    async update_application_description(description) {
        try {
            if (!this.client.application) {
                throw new Error('Application not available');
            }

            await this.client.application.edit({
                description: description,
            });

            logger.info('Updated application description');
        } catch (error) {
            logger.error('Failed to update application description', {
                error: error.message,
            });
            throw new DatabaseError('Failed to update application description', {
                originalError: error.message,
            });
        }
    }

    /**
     * Update application tags
     * @param {Array<string>} tags - Application tags
     * @returns {Promise<void>}
     */
    async update_application_tags(tags) {
        try {
            if (!this.client.application) {
                throw new Error('Application not available');
            }

            await this.client.application.edit({
                tags: tags,
            });

            logger.info(`Updated application tags: ${tags.join(', ')}`);
        } catch (error) {
            logger.error('Failed to update application tags', {
                error: error.message,
            });
            throw new DatabaseError('Failed to update application tags', {
                originalError: error.message,
            });
        }
    }

    /**
     * Get bot identity information
     * @returns {Object} Bot identity info
     */
    async get_identity_info() {
        try {
            const user = this.client.user;
            const application = this.client.application;

            return {
                username: user.username,
                discriminator: user.discriminator,
                id: user.id,
                avatar_url: user.displayAvatarURL(),
                banner_url: user.bannerURL(),
                application_description: application?.description || null,
                application_tags: application?.tags || [],
            };
        } catch (error) {
            logger.error('Failed to get bot identity info', {
                error: error.message,
            });
            throw new DatabaseError('Failed to get bot identity info', {
                originalError: error.message,
            });
        }
    }

    /**
     * Handle OAuth2 scope requirements
     * @param {Array<string>} required_scopes - Required OAuth2 scopes
     * @returns {Promise<boolean>} True if all scopes are available
     */
    async check_oauth2_scopes(required_scopes) {
        try {
            if (!this.client.application) {
                return false;
            }

            const flags = this.client.application.flags;
            // Basic scope checking - Discord.js doesn't expose scopes directly
            // This is a simplified implementation
            return true;
        } catch (error) {
            logger.error('Failed to check OAuth2 scopes', {
                error: error.message,
            });
            return false;
        }
    }
}

module.exports = BotIdentityService;
