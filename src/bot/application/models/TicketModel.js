/**
 * TicketModel
 * 
 * Model for managing support tickets.
 * Updated for new Turso DB schema with separate tables for categories, tickets, and messages.
 */

const Model = require('../../system/core/Model');
const { v4: uuidv4 } = require('uuid');

class TicketModel extends Model {
    /**
     * Create a new TicketModel instance
     * @param {Object} instance - The parent instance
     */
    constructor(instance) {
        super(instance);
        this.tableName = 'tickets';
    }

    /**
     * Create a new ticket
     * @param {string} guildId - Guild ID
     * @param {string} userId - User ID
     * @param {string} channelId - Channel ID
     * @param {string} categoryId - Ticket category ID
     * @param {string} priority - Ticket priority (low, normal, high, urgent)
     * @returns {Promise<Object>} Ticket information
     */
    async createTicket(guildId, userId, channelId, categoryId, priority = 'normal') {
        try {
            const ticketId = uuidv4();
            const now = Math.floor(Date.now() / 1000);

            await this.insert({
                id: ticketId,
                guild_id: guildId,
                channel_id: channelId,
                user_id: userId,
                category_id: categoryId,
                status: 'open',
                claimed_by: null,
                priority: priority,
                created_at: now,
                claimed_at: null,
                closed_at: null
            });

            this.log(`Created ticket ${ticketId} for user ${userId}`, 'info');

            return {
                id: ticketId,
                guildId,
                userId,
                channelId,
                categoryId,
                status: 'open',
                priority,
                createdAt: now
            };
        } catch (error) {
            this.log(`Error creating ticket: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get ticket by channel ID
     * @param {string} channelId - Channel ID
     * @param {string} guildId - Guild ID
     * @returns {Promise<Object|null>} Ticket information
     */
    async getTicketByChannel(channelId, guildId) {
        try {
            const ticket = await this.findOneBy({
                channel_id: channelId,
                guild_id: guildId
            });

            return ticket;
        } catch (error) {
            this.log(`Error getting ticket by channel: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get user's open ticket
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {Promise<Object|null>} Ticket information
     */
    async getUserOpenTicket(userId, guildId) {
        try {
            const ticket = await this.findOneBy({
                user_id: userId,
                guild_id: guildId,
                status: 'open'
            });

            return ticket;
        } catch (error) {
            this.log(`Error getting user open ticket: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Close ticket
     * @param {string} ticketId - Ticket ID
     * @param {string} closedBy - User ID who closed the ticket
     * @returns {Promise<void>}
     */
    async closeTicket(ticketId, closedBy) {
        try {
            const now = Math.floor(Date.now() / 1000);

            await this.update(ticketId, {
                status: 'closed',
                closed_at: now
            });

            this.log(`Closed ticket ${ticketId}`, 'info');
        } catch (error) {
            this.log(`Error closing ticket: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Claim ticket
     * @param {string} ticketId - Ticket ID
     * @param {string} claimedBy - User ID who claimed the ticket
     * @returns {Promise<void>}
     */
    async claimTicket(ticketId, claimedBy) {
        try {
            const now = Math.floor(Date.now() / 1000);

            await this.update(ticketId, {
                status: 'claimed',
                claimed_by: claimedBy,
                claimed_at: now
            });

            this.log(`Claimed ticket ${ticketId} by ${claimedBy}`, 'info');
        } catch (error) {
            this.log(`Error claiming ticket: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Unclaim ticket
     * @param {string} ticketId - Ticket ID
     * @returns {Promise<void>}
     */
    async unclaimTicket(ticketId) {
        try {
            await this.update(ticketId, {
                status: 'open',
                claimed_by: null,
                claimed_at: null
            });

            this.log(`Unclaimed ticket ${ticketId}`, 'info');
        } catch (error) {
            this.log(`Error unclaiming ticket: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get tickets by status
     * @param {string} guildId - Guild ID
     * @param {string} status - Ticket status ('open', 'claimed', 'closed')
     * @param {number} limit - Number of tickets to return
     * @returns {Promise<Array>} List of tickets
     */
    async getTickets(guildId, status, limit = 50) {
        try {
            const results = await this.findBy(
                { guild_id: guildId, status: status },
                { orderBy: 'created_at DESC', limit: limit }
            );

            return results || [];
        } catch (error) {
            this.log(`Error getting tickets: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Search tickets
     * @param {string} guildId - Guild ID
     * @param {Object} criteria - Search criteria (userId, categoryId, status, priority)
     * @param {number} limit - Number of tickets to return
     * @returns {Promise<Array>} List of tickets
     */
    async searchTickets(guildId, criteria = {}, limit = 50) {
        try {
            const searchCriteria = { guild_id: guildId };

            if (criteria.userId) searchCriteria.user_id = criteria.userId;
            if (criteria.categoryId) searchCriteria.category_id = criteria.categoryId;
            if (criteria.status) searchCriteria.status = criteria.status;
            if (criteria.priority) searchCriteria.priority = criteria.priority;
            if (criteria.claimedBy) searchCriteria.claimed_by = criteria.claimedBy;

            const results = await this.findBy(
                searchCriteria,
                { orderBy: 'created_at DESC', limit: limit }
            );

            return results || [];
        } catch (error) {
            this.log(`Error searching tickets: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get ticket statistics for guild
     * @param {string} guildId - Guild ID
     * @returns {Promise<Object>} Ticket statistics
     */
    async getTicketStats(guildId) {
        try {
            const openResult = await this.count({
                guild_id: guildId,
                status: 'open'
            });

            const claimedResult = await this.count({
                guild_id: guildId,
                status: 'claimed'
            });

            const closedResult = await this.count({
                guild_id: guildId,
                status: 'closed'
            });

            const totalResult = await this.count({
                guild_id: guildId
            });

            return {
                open: openResult,
                claimed: claimedResult,
                closed: closedResult,
                total: totalResult
            };
        } catch (error) {
            this.log(`Error getting ticket stats: ${error.message}`, 'error');
            return {
                open: 0,
                claimed: 0,
                closed: 0,
                total: 0
            };
        }
    }

    /**
     * Add message to ticket
     * @param {string} ticketId - Ticket ID
     * @param {string} userId - User ID who sent the message
     * @param {string} messageId - Discord message ID
     * @param {string} content - Message content
     * @param {Array} attachments - Message attachments
     * @returns {Promise<void>}
     */
    async addTicketMessage(ticketId, userId, messageId, content, attachments = []) {
        try {
            const messageRecordId = uuidv4();
            const now = Math.floor(Date.now() / 1000);

            await this.query(
                `INSERT INTO ticket_messages 
                 (id, ticket_id, user_id, message_id, content, attachments, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [messageRecordId, ticketId, userId, messageId, content, JSON.stringify(attachments), now]
            );

            this.log(`Added message to ticket ${ticketId}`, 'debug');
        } catch (error) {
            this.log(`Error adding ticket message: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get ticket messages
     * @param {string} ticketId - Ticket ID
     * @param {number} limit - Number of messages to return
     * @returns {Promise<Array>} List of messages
     */
    async getTicketMessages(ticketId, limit = 100) {
        try {
            const results = await this.query(
                `SELECT * FROM ticket_messages 
                 WHERE ticket_id = ? 
                 ORDER BY created_at ASC 
                 LIMIT ?`,
                [ticketId, limit]
            );

            // Parse attachments JSON
            return (results || []).map(msg => {
                if (msg.attachments && typeof msg.attachments === 'string') {
                    try {
                        msg.attachments = JSON.parse(msg.attachments);
                    } catch (e) {
                        msg.attachments = [];
                    }
                }
                return msg;
            });
        } catch (error) {
            this.log(`Error getting ticket messages: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Create ticket category
     * @param {string} guildId - Guild ID
     * @param {string} name - Category name
     * @param {string} description - Category description
     * @param {string} emoji - Category emoji
     * @param {Array} staffRoleIds - Staff role IDs
     * @param {string} autoResponse - Auto response message
     * @returns {Promise<Object>} Category information
     */
    async createCategory(guildId, name, description = null, emoji = null, staffRoleIds = [], autoResponse = null) {
        try {
            const categoryId = uuidv4();
            const now = Math.floor(Date.now() / 1000);

            await this.query(
                `INSERT INTO ticket_categories 
                 (id, guild_id, name, description, emoji, staff_role_ids, auto_response, is_active, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [categoryId, guildId, name, description, emoji, JSON.stringify(staffRoleIds), autoResponse, true, now]
            );

            this.log(`Created ticket category ${categoryId}`, 'info');

            return {
                id: categoryId,
                guildId,
                name,
                description,
                emoji,
                staffRoleIds,
                autoResponse,
                isActive: true
            };
        } catch (error) {
            this.log(`Error creating ticket category: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get ticket categories
     * @param {string} guildId - Guild ID
     * @param {boolean} activeOnly - Return only active categories
     * @returns {Promise<Array>} List of categories
     */
    async getCategories(guildId, activeOnly = true) {
        try {
            let sql = `SELECT * FROM ticket_categories WHERE guild_id = ?`;
            const params = [guildId];

            if (activeOnly) {
                sql += ` AND is_active = true`;
            }

            const results = await this.query(sql, params);

            // Parse staff_role_ids JSON
            return (results || []).map(cat => {
                if (cat.staff_role_ids && typeof cat.staff_role_ids === 'string') {
                    try {
                        cat.staff_role_ids = JSON.parse(cat.staff_role_ids);
                    } catch (e) {
                        cat.staff_role_ids = [];
                    }
                }
                return cat;
            });
        } catch (error) {
            this.log(`Error getting ticket categories: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Update ticket category
     * @param {string} categoryId - Category ID
     * @param {Object} updates - Updates to apply
     * @returns {Promise<void>}
     */
    async updateCategory(categoryId, updates) {
        try {
            const updateData = {};

            if (updates.name !== undefined) updateData.name = updates.name;
            if (updates.description !== undefined) updateData.description = updates.description;
            if (updates.emoji !== undefined) updateData.emoji = updates.emoji;
            if (updates.staffRoleIds !== undefined) updateData.staff_role_ids = JSON.stringify(updates.staffRoleIds);
            if (updates.autoResponse !== undefined) updateData.auto_response = updates.autoResponse;
            if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

            await this.query(
                `UPDATE ticket_categories SET ${Object.keys(updateData).map(k => `${k} = ?`).join(', ')} WHERE id = ?`,
                [...Object.values(updateData), categoryId]
            );

            this.log(`Updated ticket category ${categoryId}`, 'info');
        } catch (error) {
            this.log(`Error updating ticket category: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Delete ticket category
     * @param {string} categoryId - Category ID
     * @returns {Promise<void>}
     */
    async deleteCategory(categoryId) {
        try {
            await this.query(
                `UPDATE ticket_categories SET is_active = false WHERE id = ?`,
                [categoryId]
            );

            this.log(`Deleted ticket category ${categoryId}`, 'info');
        } catch (error) {
            this.log(`Error deleting ticket category: ${error.message}`, 'error');
            throw error;
        }
    }
}

module.exports = TicketModel;
