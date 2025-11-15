/**
 * QueryOptimizer
 * 
 * Provides optimized query patterns and helpers for frequently used queries.
 * Includes query rewriting and index recommendations.
 */

class QueryOptimizer {
    /**
     * Create a new QueryOptimizer
     * @param {Object} database - Database instance
     */
    constructor(database) {
        this.db = database;
        this.logger = database.logger || console;
    }

    /**
     * Optimize a SELECT query by analyzing and rewriting it
     * @param {string} sql - Original SQL query
     * @param {Array} params - Query parameters
     * @returns {Object} Optimized query and recommendations
     */
    analyzeQuery(sql, params = []) {
        const recommendations = [];
        let optimizedSql = sql;

        // Check for SELECT *
        if (sql.includes('SELECT *')) {
            recommendations.push({
                type: 'SELECT_STAR',
                message: 'Avoid SELECT * - specify only needed columns',
                severity: 'medium'
            });
        }

        // Check for missing WHERE clause in SELECT
        if (sql.toUpperCase().includes('SELECT') && !sql.toUpperCase().includes('WHERE')) {
            recommendations.push({
                type: 'MISSING_WHERE',
                message: 'Consider adding WHERE clause to limit results',
                severity: 'low'
            });
        }

        // Check for ORDER BY without LIMIT
        if (sql.toUpperCase().includes('ORDER BY') && !sql.toUpperCase().includes('LIMIT')) {
            recommendations.push({
                type: 'ORDER_WITHOUT_LIMIT',
                message: 'ORDER BY without LIMIT may be inefficient',
                severity: 'medium'
            });
        }

        // Check for multiple COUNT queries that could be combined
        if (sql.toUpperCase().includes('COUNT(*)')) {
            recommendations.push({
                type: 'COUNT_OPTIMIZATION',
                message: 'Consider combining multiple COUNT queries with CASE statements',
                severity: 'low'
            });
        }

        return {
            originalSql: sql,
            optimizedSql,
            recommendations,
            params
        };
    }

    /**
     * Get optimized query for guild data lookup
     * @param {string} guildId - Guild ID
     * @param {Array<string>} columns - Columns to select
     * @returns {Object} Query and parameters
     */
    getGuildQuery(guildId, columns = ['*']) {
        const columnList = columns.join(', ');
        return {
            sql: `SELECT ${columnList} FROM guilds WHERE id = ? LIMIT 1`,
            params: [guildId]
        };
    }

    /**
     * Get optimized query for user level lookup with ranking
     * @param {string} guildId - Guild ID
     * @param {string} userId - User ID
     * @returns {Object} Query and parameters
     */
    getUserLevelWithRankQuery(guildId, userId) {
        return {
            sql: `
                SELECT 
                    ul.*,
                    (SELECT COUNT(*) + 1 FROM user_levels 
                     WHERE guild_id = ? AND xp > ul.xp) as rank
                FROM user_levels ul
                WHERE ul.guild_id = ? AND ul.user_id = ?
                LIMIT 1
            `,
            params: [guildId, guildId, userId]
        };
    }

    /**
     * Get optimized leaderboard query
     * @param {string} guildId - Guild ID
     * @param {number} limit - Number of results
     * @param {number} offset - Offset for pagination
     * @returns {Object} Query and parameters
     */
    getLeaderboardQuery(guildId, limit = 10, offset = 0) {
        return {
            sql: `
                SELECT 
                    user_id,
                    xp,
                    level,
                    total_messages,
                    ROW_NUMBER() OVER (ORDER BY xp DESC) as rank
                FROM user_levels
                WHERE guild_id = ?
                ORDER BY xp DESC
                LIMIT ? OFFSET ?
            `,
            params: [guildId, limit, offset]
        };
    }

    /**
     * Get optimized query for economy balance with ranking
     * @param {string} guildId - Guild ID
     * @param {string} userId - User ID
     * @returns {Object} Query and parameters
     */
    getEconomyBalanceWithRankQuery(guildId, userId) {
        return {
            sql: `
                SELECT 
                    ea.*,
                    (SELECT COUNT(*) + 1 FROM economy_accounts 
                     WHERE guild_id = ? AND (wallet_balance + bank_balance) > (ea.wallet_balance + ea.bank_balance)) as rank
                FROM economy_accounts ea
                WHERE ea.guild_id = ? AND ea.user_id = ?
                LIMIT 1
            `,
            params: [guildId, guildId, userId]
        };
    }

    /**
     * Get optimized query for active warnings count
     * @param {string} guildId - Guild ID
     * @param {string} userId - User ID (optional)
     * @returns {Object} Query and parameters
     */
    getActiveWarningsQuery(guildId, userId = null) {
        if (userId) {
            return {
                sql: `
                    SELECT COUNT(*) as count
                    FROM user_warnings
                    WHERE guild_id = ? AND user_id = ? AND is_active = true
                    AND (expires_at IS NULL OR expires_at > ?)
                `,
                params: [guildId, userId, Date.now()]
            };
        }

        return {
            sql: `
                SELECT COUNT(*) as count
                FROM user_warnings
                WHERE guild_id = ? AND is_active = true
                AND (expires_at IS NULL OR expires_at > ?)
            `,
            params: [guildId, Date.now()]
        };
    }

    /**
     * Get optimized query for moderation statistics (single query instead of multiple)
     * @param {string} guildId - Guild ID
     * @returns {Object} Query and parameters
     */
    getModerationStatsQuery(guildId) {
        return {
            sql: `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN action = 'warn' THEN 1 ELSE 0 END) as warnings,
                    SUM(CASE WHEN action = 'kick' THEN 1 ELSE 0 END) as kicks,
                    SUM(CASE WHEN action = 'ban' THEN 1 ELSE 0 END) as bans,
                    SUM(CASE WHEN action = 'timeout' THEN 1 ELSE 0 END) as timeouts
                FROM moderation_logs
                WHERE guild_id = ?
            `,
            params: [guildId]
        };
    }

    /**
     * Get optimized query for recent activity
     * @param {string} guildId - Guild ID
     * @param {number} hours - Hours to look back
     * @param {number} limit - Number of results
     * @returns {Object} Query and parameters
     */
    getRecentActivityQuery(guildId, hours = 24, limit = 50) {
        const timestamp = Date.now() - (hours * 60 * 60 * 1000);
        return {
            sql: `
                SELECT 
                    user_id,
                    COUNT(*) as message_count,
                    MAX(last_xp_at) as last_activity
                FROM user_levels
                WHERE guild_id = ? AND last_xp_at > ?
                GROUP BY user_id
                ORDER BY message_count DESC
                LIMIT ?
            `,
            params: [guildId, timestamp, limit]
        };
    }

    /**
     * Get optimized query for playlist with track count
     * @param {string} playlistId - Playlist ID
     * @returns {Object} Query and parameters
     */
    getPlaylistWithTracksQuery(playlistId) {
        return {
            sql: `
                SELECT 
                    p.*,
                    (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) as track_count,
                    (SELECT SUM(track_duration) FROM playlist_tracks WHERE playlist_id = p.id) as total_duration
                FROM user_playlists p
                WHERE p.id = ?
                LIMIT 1
            `,
            params: [playlistId]
        };
    }

    /**
     * Suggest indexes based on query patterns
     * @param {Array<Object>} queryHistory - Query history from performance logger
     * @returns {Array<Object>} Index recommendations
     */
    suggestIndexes(queryHistory) {
        const recommendations = [];
        const tableColumns = new Map();

        // Analyze WHERE clauses
        for (const query of queryHistory) {
            const sql = query.sql.toUpperCase();

            // Extract table and column from WHERE clause
            const whereMatch = sql.match(/FROM\s+(\w+).*WHERE\s+(\w+)\s*=/);
            if (whereMatch) {
                const [, table, column] = whereMatch;
                const key = `${table}.${column}`;

                if (!tableColumns.has(key)) {
                    tableColumns.set(key, {
                        table,
                        column,
                        count: 0,
                        avgTime: 0
                    });
                }

                const entry = tableColumns.get(key);
                entry.count++;
                entry.avgTime = (entry.avgTime * (entry.count - 1) + query.executionTime) / entry.count;
            }
        }

        // Generate recommendations for frequently queried columns
        for (const [key, data] of tableColumns) {
            if (data.count >= 10 && data.avgTime > 100) {
                recommendations.push({
                    table: data.table,
                    column: data.column,
                    reason: `Frequently queried (${data.count} times) with avg time ${data.avgTime.toFixed(2)}ms`,
                    sql: `CREATE INDEX IF NOT EXISTS idx_${data.table}_${data.column} ON ${data.table}(${data.column});`,
                    priority: data.avgTime > 500 ? 'high' : 'medium'
                });
            }
        }

        return recommendations;
    }

    /**
     * Log optimization recommendations
     * @param {Object} analysis - Query analysis result
     */
    logRecommendations(analysis) {
        if (analysis.recommendations.length === 0) {
            return;
        }

        const highSeverity = analysis.recommendations.filter(r => r.severity === 'high');
        if (highSeverity.length > 0) {
            this.logger.warn('[QueryOptimizer] High priority optimizations available', {
                sql: analysis.originalSql,
                recommendations: highSeverity
            });
        }
    }
}

module.exports = QueryOptimizer;
