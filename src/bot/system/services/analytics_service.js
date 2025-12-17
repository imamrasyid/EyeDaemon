/**
 * Analytics Service
 *
 * Tracks command usage, guild growth, activity metrics, and provides summaries.
 */

const logger = require('../helpers/logger_helper');

class AnalyticsService {
    constructor(client) {
        this.client = client;
        this.database = client.database;
    }

    /**
     * Track command usage
     */
    async track_command(command_name, guild_id, user_id) {
        try {
            await this.database.query(
                `INSERT INTO command_usage (command_name, guild_id, user_id, used_at)
                 VALUES (?, ?, ?, ?)`
                , [command_name, guild_id || 'dm', user_id, Date.now()]);
        } catch (error) {
            logger.warn('Failed to track command usage', { error: error.message });
        }
    }

    /**
     * Track guild join/leave
     */
    async track_guild_event(guild_id, event) {
        try {
            await this.database.query(
                `INSERT INTO guild_activity (guild_id, event, occurred_at)
                 VALUES (?, ?, ?)`
                , [guild_id, event, Date.now()]);
        } catch (error) {
            logger.warn('Failed to track guild event', { error: error.message });
        }
    }

    /**
     * Track message volume (per guild)
     */
    async track_message(guild_id) {
        try {
            await this.database.query(
                `INSERT INTO message_stats (guild_id, occurred_at)
                 VALUES (?, ?)`
                , [guild_id || 'dm', Date.now()]);
        } catch (error) {
            logger.warn('Failed to track message', { error: error.message });
        }
    }

    /**
     * Get basic stats summary
     */
    async get_summary(guild_id = null) {
        try {
            const scope = guild_id ? 'WHERE guild_id = ?' : '';
            const params = guild_id ? [guild_id] : [];

            const commands = await this.database.query(
                `SELECT COUNT(*) as count FROM command_usage ${scope}`,
                params
            );
            const messages = await this.database.query(
                `SELECT COUNT(*) as count FROM message_stats ${scope}`,
                params
            );
            const guild_events = await this.database.query(
                `SELECT event, COUNT(*) as count FROM guild_activity ${scope} GROUP BY event`,
                params
            );

            return {
                commands: commands?.[0]?.count || 0,
                messages: messages?.[0]?.count || 0,
                guild_events,
            };
        } catch (error) {
            logger.warn('Failed to get analytics summary', { error: error.message });
            return { commands: 0, messages: 0, guild_events: [] };
        }
    }
}

module.exports = AnalyticsService;
