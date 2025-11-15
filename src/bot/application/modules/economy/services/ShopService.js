/**
 * ShopService
 * 
 * Business logic for shop operations including item management,
 * purchases, and inventory operations.
 */

const BaseService = require('../../../../system/core/BaseService');

class ShopService extends BaseService {
    /**
     * Create a new ShopService instance
     * @param {Object} client - Discord client instance
     * @param {Object} options - Service configuration options
     */
    constructor(client, options = {}) {
        super(client, options);
    }

    /**
     * Initialize service
     * @returns {Promise<void>}
     */
    async initialize() {
        await super.initialize();
        this.log('ShopService initialized', 'info');
    }

    /**
     * Create a new shop item
     * @param {string} guildId - Guild ID
     * @param {string} name - Item name
     * @param {string} description - Item description
     * @param {number} price - Item price
     * @param {number} stock - Item stock (-1 for unlimited)
     * @param {string} roleId - Role ID to give on purchase (optional)
     * @returns {Promise<Object>} Created item
     */
    async createItem(guildId, name, description, price, stock = -1, roleId = null) {
        this.validateRequired({ guildId, name, description, price }, ['guildId', 'name', 'description', 'price']);

        if (price < 0) {
            throw new Error('Price must be non-negative');
        }

        try {
            const itemId = `${guildId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            await this.query(
                `INSERT INTO shop_items (id, guild_id, name, description, price, stock, role_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [itemId, guildId, name, description, price, stock, roleId, Date.now()]
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
     * Get shop item by ID
     * @param {string} itemId - Item ID
     * @returns {Promise<Object|null>} Item or null
     */
    async getItem(itemId) {
        this.validateRequired({ itemId }, ['itemId']);

        try {
            const result = await this.query(
                'SELECT * FROM shop_items WHERE id = ?',
                [itemId]
            );

            return result && result.length > 0 ? result[0] : null;
        } catch (error) {
            throw this.handleError(error, 'getItem', { itemId });
        }
    }

    /**
     * Get all shop items for a guild
     * @param {string} guildId - Guild ID
     * @returns {Promise<Array>} Array of items
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
     * Update shop item
     * @param {string} itemId - Item ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated item
     */
    async updateItem(itemId, updates) {
        this.validateRequired({ itemId }, ['itemId']);

        try {
            const allowedFields = ['name', 'description', 'price', 'stock', 'role_id'];
            const updateFields = [];
            const updateValues = [];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    updateFields.push(`${key} = ?`);
                    updateValues.push(value);
                }
            }

            if (updateFields.length === 0) {
                throw new Error('No valid fields to update');
            }

            updateValues.push(itemId);

            await this.query(
                `UPDATE shop_items SET ${updateFields.join(', ')} WHERE id = ?`,
                updateValues
            );

            this.log(`Updated shop item ${itemId}`, 'info');

            return await this.getItem(itemId);
        } catch (error) {
            throw this.handleError(error, 'updateItem', { itemId, updates });
        }
    }

    /**
     * Delete shop item
     * @param {string} itemId - Item ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteItem(itemId) {
        this.validateRequired({ itemId }, ['itemId']);

        try {
            await this.query('DELETE FROM shop_items WHERE id = ?', [itemId]);
            this.log(`Deleted shop item ${itemId}`, 'info');
            return true;
        } catch (error) {
            throw this.handleError(error, 'deleteItem', { itemId });
        }
    }

    /**
     * Purchase an item
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {string} itemId - Item ID
     * @param {number} quantity - Quantity to purchase
     * @returns {Promise<Object>} Purchase result
     */
    async purchaseItem(userId, guildId, itemId, quantity = 1) {
        this.validateRequired({ userId, guildId, itemId, quantity }, ['userId', 'guildId', 'itemId', 'quantity']);

        if (quantity <= 0) {
            throw new Error('Quantity must be positive');
        }

        try {
            // Get item
            const item = await this.getItem(itemId);

            if (!item) {
                return {
                    success: false,
                    message: 'Item not found'
                };
            }

            if (item.guild_id !== guildId) {
                return {
                    success: false,
                    message: 'Item not available in this guild'
                };
            }

            // Check stock
            if (item.stock !== -1 && item.stock < quantity) {
                return {
                    success: false,
                    message: `Insufficient stock. Available: ${item.stock}`
                };
            }

            const totalPrice = item.price * quantity;

            // Get economy service to check balance
            const economyModule = this.client.modules.get('economy');
            if (!economyModule) {
                throw new Error('Economy module not available');
            }

            const economyService = economyModule.getService('EconomyService');
            if (!economyService) {
                throw new Error('EconomyService not available');
            }

            const balance = await economyService.getBalance(userId, guildId);

            if (balance.wallet < totalPrice) {
                return {
                    success: false,
                    message: `Insufficient balance. Required: ${totalPrice}, Available: ${balance.wallet}`
                };
            }

            // Deduct balance
            await economyService.removeBalance(userId, guildId, totalPrice, `Purchased ${quantity}x ${item.name}`);

            // Update stock
            if (item.stock !== -1) {
                await this.query(
                    'UPDATE shop_items SET stock = stock - ? WHERE id = ?',
                    [quantity, itemId]
                );
            }

            // Add to inventory
            await this.addToInventory(userId, guildId, itemId, quantity);

            this.log(`User ${userId} purchased ${quantity}x ${item.name}`, 'info');

            return {
                success: true,
                item,
                quantity,
                totalPrice,
                newBalance: balance.wallet - totalPrice
            };
        } catch (error) {
            throw this.handleError(error, 'purchaseItem', { userId, guildId, itemId, quantity });
        }
    }

    /**
     * Add item to user inventory
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {string} itemId - Item ID
     * @param {number} quantity - Quantity to add
     * @returns {Promise<void>}
     */
    async addToInventory(userId, guildId, itemId, quantity) {
        try {
            // Get member ID
            const memberResult = await this.query(
                'SELECT id FROM members WHERE user_id = ? AND guild_id = ?',
                [userId, guildId]
            );

            if (!memberResult || memberResult.length === 0) {
                throw new Error('Member not found');
            }

            const memberId = memberResult[0].id;

            // Check if item already in inventory
            const existing = await this.query(
                'SELECT quantity FROM inventory WHERE member_id = ? AND item_id = ?',
                [memberId, itemId]
            );

            if (existing && existing.length > 0) {
                // Update quantity
                await this.query(
                    'UPDATE inventory SET quantity = quantity + ? WHERE member_id = ? AND item_id = ?',
                    [quantity, memberId, itemId]
                );
            } else {
                // Insert new
                await this.query(
                    'INSERT INTO inventory (member_id, item_id, quantity, purchased_at) VALUES (?, ?, ?, ?)',
                    [memberId, itemId, quantity, Date.now()]
                );
            }

            this.log(`Added ${quantity}x item ${itemId} to user ${userId} inventory`, 'debug');
        } catch (error) {
            throw this.handleError(error, 'addToInventory', { userId, guildId, itemId, quantity });
        }
    }

    /**
     * Get user inventory
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @returns {Promise<Array>} Array of inventory items with details
     */
    async getInventory(userId, guildId) {
        this.validateRequired({ userId, guildId }, ['userId', 'guildId']);

        try {
            // Get member ID
            const memberResult = await this.query(
                'SELECT id FROM members WHERE user_id = ? AND guild_id = ?',
                [userId, guildId]
            );

            if (!memberResult || memberResult.length === 0) {
                return [];
            }

            const memberId = memberResult[0].id;

            // Get inventory with item details
            const inventory = await this.query(
                `SELECT i.quantity, i.purchased_at, s.id, s.name, s.description, s.price, s.role_id
                FROM inventory i
                JOIN shop_items s ON i.item_id = s.id
                WHERE i.member_id = ?
                ORDER BY i.purchased_at DESC`,
                [memberId]
            );

            return inventory || [];
        } catch (error) {
            throw this.handleError(error, 'getInventory', { userId, guildId });
        }
    }

    /**
     * Remove item from inventory
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {string} itemId - Item ID
     * @param {number} quantity - Quantity to remove
     * @returns {Promise<boolean>} Success status
     */
    async removeFromInventory(userId, guildId, itemId, quantity) {
        this.validateRequired({ userId, guildId, itemId, quantity }, ['userId', 'guildId', 'itemId', 'quantity']);

        if (quantity <= 0) {
            throw new Error('Quantity must be positive');
        }

        try {
            // Get member ID
            const memberResult = await this.query(
                'SELECT id FROM members WHERE user_id = ? AND guild_id = ?',
                [userId, guildId]
            );

            if (!memberResult || memberResult.length === 0) {
                throw new Error('Member not found');
            }

            const memberId = memberResult[0].id;

            // Check current quantity
            const existing = await this.query(
                'SELECT quantity FROM inventory WHERE member_id = ? AND item_id = ?',
                [memberId, itemId]
            );

            if (!existing || existing.length === 0) {
                throw new Error('Item not in inventory');
            }

            const currentQuantity = existing[0].quantity;

            if (currentQuantity < quantity) {
                throw new Error(`Insufficient quantity. Available: ${currentQuantity}`);
            }

            if (currentQuantity === quantity) {
                // Remove completely
                await this.query(
                    'DELETE FROM inventory WHERE member_id = ? AND item_id = ?',
                    [memberId, itemId]
                );
            } else {
                // Decrease quantity
                await this.query(
                    'UPDATE inventory SET quantity = quantity - ? WHERE member_id = ? AND item_id = ?',
                    [quantity, memberId, itemId]
                );
            }

            this.log(`Removed ${quantity}x item ${itemId} from user ${userId} inventory`, 'debug');

            return true;
        } catch (error) {
            throw this.handleError(error, 'removeFromInventory', { userId, guildId, itemId, quantity });
        }
    }

    /**
     * Use an item from inventory
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {string} itemId - Item ID
     * @returns {Promise<Object>} Use result
     */
    async useItem(userId, guildId, itemId) {
        this.validateRequired({ userId, guildId, itemId }, ['userId', 'guildId', 'itemId']);

        try {
            const item = await this.getItem(itemId);

            if (!item) {
                return {
                    success: false,
                    message: 'Item not found'
                };
            }

            // Check if item is in inventory
            const inventory = await this.getInventory(userId, guildId);
            const inventoryItem = inventory.find(i => i.id === itemId);

            if (!inventoryItem || inventoryItem.quantity === 0) {
                return {
                    success: false,
                    message: 'Item not in inventory'
                };
            }

            // If item has a role, assign it
            if (item.role_id) {
                const guild = this.getGuild(guildId);
                if (guild) {
                    const member = await guild.members.fetch(userId);
                    const role = guild.roles.cache.get(item.role_id);

                    if (role && member) {
                        await member.roles.add(role);
                        this.log(`Assigned role ${role.name} to user ${userId}`, 'info');
                    }
                }
            }

            // Remove from inventory
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
