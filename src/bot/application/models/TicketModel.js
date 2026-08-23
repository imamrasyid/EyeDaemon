'use strict';

/**
 * TicketModel
 * 
 * Manages tickets and ticket counters.
 * Synchronized with consolidated schema.
 */

const Model = require('../../system/core/Model');
const { randomUUID } = require('crypto');

class TicketModel extends Model {
    constructor(instance) {
        super(instance);
        this.tableName = 'tickets';
        this.primaryKey = 'id';
    }

    /**
     * Get the next ticket number for a guild
     * @param {string} guildId
     * @returns {Promise<number>}
     */
    async getNextTicketNumber(guildId) {
        try {
            await this.query(
                `INSERT INTO ticket_counters (guild_id, last_number)
                 VALUES (?, 1)
                 ON CONFLICT(guild_id) DO UPDATE SET last_number = last_number + 1`,
                [guildId]
            );

            const result = await this.queryOne(
                `SELECT last_number FROM ticket_counters WHERE guild_id = ?`,
                [guildId]
            );

            return result?.last_number || 1;
        } catch (error) {
            this.log(`Error getting next ticket number: ${error.message}`, 'warn');
            return 1;
        }
    }

    /**
     * Create a new ticket
     * @param {string} guildId
     * @param {string} userId
     * @param {string} channelId
     * @param {string} category
     * @param {string} [description]
     * @param {number} [ticketNumber]
     * @returns {Promise<Object>}
     */
    async createTicket(guildId, userId, channelId, category, description = null, ticketNumber = 1) {
        try {
            const ticketId = randomUUID();
            const now = Math.floor(Date.now() / 1000);

            // Ensure user profile exists for FK
            await this.query(
                `INSERT INTO user_profiles (user_id, created_at, updated_at)
                 VALUES (?, ?, ?)
                 ON CONFLICT(user_id) DO NOTHING`,
                [userId, now, now]
            );

            await this.query(
                `INSERT INTO tickets (id, guild_id, user_id, channel_id, category, status, closed_at, created_at)
                 VALUES (?, ?, ?, ?, ?, 'open', NULL, ?)`,
                [ticketId, guildId, userId, channelId, category, now]
            );

            this.log(`Created ticket #${ticketNumber} (${ticketId}) for user ${userId}`, 'info');

            return {
                id: ticketId,
                ticket_number: ticketNumber,
                guildId,
                userId,
                channelId,
                category,
                description,
                status: 'open',
                createdAt: now
            };
        } catch (error) {
            this.log(`Error creating ticket: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get ticket by channel ID
     * @param {string} channelId
     * @param {string} guildId
     * @returns {Promise<Object|null>}
     */
    async getTicketByChannel(channelId, guildId) {
        try {
            const rows = await this.query(
                `SELECT * FROM tickets WHERE channel_id = ? AND guild_id = ?`,
                [channelId, guildId]
            );
            return rows?.[0] || null;
        } catch (error) {
            this.log(`Error getting ticket by channel: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get user open ticket
     * @param {string} userId
     * @param {string} guildId
     * @returns {Promise<Object|null>}
     */
    async getUserOpenTicket(userId, guildId) {
        try {
            const rows = await this.query(
                `SELECT * FROM tickets WHERE user_id = ? AND guild_id = ? AND status = 'open'`,
                [userId, guildId]
            );
            return rows?.[0] || null;
        } catch (error) {
            this.log(`Error getting user open ticket: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Close a ticket
     * @param {string} ticketId
     * @param {string} closedBy
     */
    async closeTicket(ticketId, closedBy) {
        try {
            const now = Math.floor(Date.now() / 1000);
            await this.query(
                `UPDATE tickets SET status = 'closed', closed_at = ? WHERE id = ?`,
                [now, ticketId]
            );
            this.log(`Closed ticket ${ticketId} by ${closedBy}`, 'info');
        } catch (error) {
            this.log(`Error closing ticket: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Claim a ticket
     * @param {string} ticketId
     * @param {string} userId
     */
    async claimTicket(ticketId, userId) {
        try {
            await this.query(`UPDATE tickets SET claimed_by = ? WHERE id = ?`, [userId, ticketId]);
            this.log(`Claimed ticket ${ticketId} by ${userId}`, 'info');
            return true;
        } catch (error) {
            this.log(`Error claiming ticket: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Unclaim a ticket
     * @param {string} ticketId
     */
    async unclaimTicket(ticketId) {
        try {
            await this.query(`UPDATE tickets SET claimed_by = NULL WHERE id = ?`, [ticketId]);
            this.log(`Unclaimed ticket ${ticketId}`, 'info');
            return true;
        } catch (error) {
            this.log(`Error unclaiming ticket: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get tickets by status
     * @param {string} guildId
     * @param {string} status
     * @param {number} limit
     * @returns {Promise<Array>}
     */
    async getTickets(guildId, status, limit = 50) {
        try {
            const rows = await this.query(
                `SELECT * FROM tickets WHERE guild_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?`,
                [guildId, status, limit]
            );
            return rows || [];
        } catch (error) {
            this.log(`Error getting tickets: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get ticket stats
     * @param {string} guildId
     * @returns {Promise<Object>}
     */
    async getTicketStats(guildId) {
        try {
            const open = (await this.query(
                `SELECT COUNT(*) as c FROM tickets WHERE guild_id = ? AND status = 'open'`,
                [guildId]
            ))?.[0]?.c || 0;

            const closed = (await this.query(
                `SELECT COUNT(*) as c FROM tickets WHERE guild_id = ? AND status = 'closed'`,
                [guildId]
            ))?.[0]?.c || 0;

            return {
                open,
                closed,
                total: open + closed
            };
        } catch (error) {
            this.log(`Error getting ticket stats: ${error.message}`, 'error');
            return { open: 0, closed: 0, total: 0 };
        }
    }
}

module.exports = TicketModel;
