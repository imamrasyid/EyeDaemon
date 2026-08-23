'use strict';

/**
 * ShopService
 * 
 * Business logic for shop operations including item management,
 * purchases, and inventory operations.
 * Synchronized with consolidated schema:
 * - shop_items (id, guild_id, name, description, price, role_id, stock, created_at)
 * - user_inventories (user_id, guild_id, item_id, quantity, created_at, PRIMARY KEY(user_id, guild_id, item_id))
 */

const BaseService = require('../../../../system/core/BaseService');
const { randomUUID } = require('crypto');

class ShopService extends BaseService {
    constructor(client, options = {}) {
        super(client, options);
    }

    async initialize() {
        await super.initialize();
        this.log('ShopService initialized', 'info');
    }

    /**
     * Create a new shop item
     */
    async createItem(guildId, name, description, price, stock = -1, roleId = null) {
        this.validateRequired({ guildId, name, description, price }, ['guildId', 'name', 'description', 'price']);

        if (price < 0) {
            throw new Error('Price must be non-negative');
        }

        try {
            const itemId = randomUUID();
            const now = Math.floor(Date.now() / 1000);

            await this.query(
                `INSERT INTO shop_items (id, guild_id, name, description, price, role_id, stock, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [itemId, guildId, name, description, price, roleId, stock, now]
            );

            this.log(`Created shop item ${name} in guild ${guildId}`, 'info');

            return {
                id: itemId,
                guildId,
                name,
                description,
                price,
                stock,
                roleId
            };
        } catch (error) {
            throw this.handleError(error, 'createItem', { guildId, name, price });
        }
    }

    /**
     * Get item by ID
     */
    async getItem(itemId) {
        this.validateRequired({ itemId }, ['itemId']);

        try {
            const rows = await this.query('SELECT * FROM shop_items WHERE id = ?', [itemId]);
            return rows?.[0] || null;
        } catch (error) {
            throw this.handleError(error, 'getItem', { itemId });
        }
    }

    /**
     * Get all shop items for a guild
     */
    async getItems(guildId) {
        this.validateRequired({ guildId }, ['guildId']);

        try {
            const items = await this.query(
                'SELECT * FROM shop_items WHERE guild_id = ? ORDER BY price ASC',
                [guildId]
            );
            return items || [];
        } catch (error) {
            throw this.handleError(error, 'getItems', { guildId });
        }
    }

    /**
     * Update item
     */
    async updateItem(itemId, updates) {
        this.validateRequired({ itemId }, ['itemId']);

        try {
            const allowed = ['name', 'description', 'price', 'stock', 'role_id'];
            const fields = [];
            const values = [];

            for (const [k, v] of Object.entries(updates)) {
                if (allowed.includes(k)) {
                    fields.push(`${k} = ?`);
                    values.push(v);
                }
            }

            if (fields.length === 0) throw new Error('No valid fields to update');
            values.push(itemId);

            await this.query(`UPDATE shop_items SET ${fields.join(', ')} WHERE id = ?`, values);
            return await this.getItem(itemId);
        } catch (error) {
            throw this.handleError(error, 'updateItem', { itemId, updates });
        }
    }

    /**
     * Delete item
     */
    async deleteItem(itemId) {
        this.validateRequired({ itemId }, ['itemId']);

        try {
            await this.query('DELETE FROM shop_items WHERE id = ?', [itemId]);
            return true;
        } catch (error) {
            throw this.handleError(error, 'deleteItem', { itemId });
        }
    }

    /**
     * Purchase item
     */
    async purchaseItem(userId, guildId, itemId, quantity = 1) {
        this.validateRequired({ userId, guildId, itemId, quantity }, ['userId', 'guildId', 'itemId', 'quantity']);

        if (quantity <= 0) throw new Error('Quantity must be positive');

        try {
            const item = await this.getItem(itemId);
            if (!item) return { success: false, message: 'Item not found' };
            if (item.guild_id !== guildId) return { success: false, message: 'Item not available in this guild' };
            if (item.stock !== -1 && item.stock < quantity) {
                return { success: false, message: `Insufficient stock. Available: ${item.stock}` };
            }

            const totalPrice = item.price * quantity;
            const db = this.getDatabase();
            const now = Math.floor(Date.now() / 1000);
            let newBalance = 0;

            await db.transaction(async (tx) => {
                const balRows = await tx.query(
                    `SELECT balance FROM economy_accounts WHERE user_id = ? AND guild_id = ?`,
                    [userId, guildId]
                );
                const currentBal = balRows?.[0]?.balance ?? 0;

                if (currentBal < totalPrice) {
                    const err = new Error('INSUFFICIENT_BALANCE');
                    err.code = 'INSUFFICIENT_BALANCE';
                    throw err;
                }

                // Deduct balance
                await tx.query(
                    `UPDATE economy_accounts SET balance = balance - ?, updated_at = ? WHERE user_id = ? AND guild_id = ?`,
                    [totalPrice, now, userId, guildId]
                );

                // Update stock if not unlimited
                if (item.stock !== -1) {
                    const stockRes = await tx.query(
                        `UPDATE shop_items SET stock = stock - ? WHERE id = ? AND stock >= ?`,
                        [quantity, itemId, quantity]
                    );
                    if (!stockRes || stockRes.changes === 0) {
                        const err = new Error('INSUFFICIENT_STOCK');
                        err.code = 'INSUFFICIENT_STOCK';
                        throw err;
                    }
                }

                // Add to user inventory
                await tx.query(
                    `INSERT INTO user_inventories (user_id, guild_id, item_id, quantity, created_at)
                     VALUES (?, ?, ?, ?, ?)
                     ON CONFLICT(user_id, guild_id, item_id) DO UPDATE SET quantity = quantity + ?`,
                    [userId, guildId, itemId, quantity, now, quantity]
                );

                // Log transaction
                await tx.query(
                    `INSERT INTO economy_transactions (user_id, guild_id, type, amount, balance_before, balance_after, reason, created_at)
                     VALUES (?, ?, 'purchase', ?, ?, ?, ?, ?)`,
                    [userId, guildId, -totalPrice, currentBal, currentBal - totalPrice, `Purchased ${quantity}x ${item.name}`, now]
                );

                newBalance = currentBal - totalPrice;
            });

            return {
                success: true,
                item,
                quantity,
                totalPrice,
                newBalance
            };
        } catch (error) {
            if (error.code === 'INSUFFICIENT_BALANCE') {
                return { success: false, message: 'Insufficient balance' };
            }
            if (error.code === 'INSUFFICIENT_STOCK') {
                return { success: false, message: 'Insufficient stock' };
            }
            throw this.handleError(error, 'purchaseItem', { userId, guildId, itemId, quantity });
        }
    }

    /**
     * Get inventory for a user
     */
    async getInventory(userId, guildId) {
        this.validateRequired({ userId, guildId }, ['userId', 'guildId']);

        try {
            const rows = await this.query(
                `SELECT i.quantity, i.created_at, s.id, s.name, s.description, s.price, s.role_id
                 FROM user_inventories i
                 JOIN shop_items s ON i.item_id = s.id
                 WHERE i.guild_id = ? AND i.user_id = ?
                 ORDER BY i.created_at DESC`,
                [guildId, userId]
            );

            return rows || [];
        } catch (error) {
            throw this.handleError(error, 'getInventory', { userId, guildId });
        }
    }

    /**
     * Remove from inventory
     */
    async removeFromInventory(userId, guildId, itemId, quantity = 1) {
        this.validateRequired({ userId, guildId, itemId, quantity }, ['userId', 'guildId', 'itemId', 'quantity']);

        try {
            const rows = await this.query(
                'SELECT quantity FROM user_inventories WHERE guild_id = ? AND user_id = ? AND item_id = ?',
                [guildId, userId, itemId]
            );

            if (!rows || rows.length === 0) throw new Error('Item not in inventory');

            const current = rows[0].quantity;
            if (current < quantity) throw new Error(`Insufficient quantity. Available: ${current}`);

            if (current === quantity) {
                await this.query(
                    'DELETE FROM user_inventories WHERE guild_id = ? AND user_id = ? AND item_id = ?',
                    [guildId, userId, itemId]
                );
            } else {
                await this.query(
                    'UPDATE user_inventories SET quantity = quantity - ? WHERE guild_id = ? AND user_id = ? AND item_id = ?',
                    [quantity, guildId, userId, itemId]
                );
            }

            return true;
        } catch (error) {
            throw this.handleError(error, 'removeFromInventory', { userId, guildId, itemId, quantity });
        }
    }

    /**
     * Use item
     */
    async useItem(userId, guildId, itemId) {
        this.validateRequired({ userId, guildId, itemId }, ['userId', 'guildId', 'itemId']);

        try {
            const item = await this.getItem(itemId);
            if (!item) return { success: false, message: 'Item not found' };

            const inventory = await this.getInventory(userId, guildId);
            const invItem = inventory.find(i => i.id === itemId);

            if (!invItem || invItem.quantity <= 0) {
                return { success: false, message: 'Item not in inventory' };
            }

            if (item.role_id) {
                const guild = this.getGuild(guildId);
                if (guild) {
                    const member = await guild.members.fetch(userId);
                    const role = guild.roles.cache.get(item.role_id);
                    if (role && member) {
                        await member.roles.add(role);
                    }
                }
            }

            await this.removeFromInventory(userId, guildId, itemId, 1);

            return {
                success: true,
                item,
                message: `Used ${item.name}`
            };
        } catch (error) {
            throw this.handleError(error, 'useItem', { userId, guildId, itemId });
        }
    }
}

module.exports = ShopService;
