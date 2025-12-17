/**
 * Webhook Service
 *
 * Manages creation, caching, and sending of webhooks for integrations and logging.
 */

const logger = require('../helpers/logger_helper');
const { DatabaseError } = require('../core/Errors');

class WebhookService {
    constructor(client) {
        this.client = client;
        this.database = client.database;
        this.webhook_cache = new Map();
    }

    /**
     * Get or create webhook for a channel
     * @param {string} channel_id - Target channel ID
     * @param {Object} options - { name, avatar }
     * @returns {Promise<string>} Webhook URL
     */
    async get_or_create(channel_id, options = {}) {
        if (this.webhook_cache.has(channel_id)) {
            return this.webhook_cache.get(channel_id);
        }

        try {
            const channel = await this.client.channels.fetch(channel_id);
            if (!channel || !channel.isTextBased()) {
                throw new Error('Channel not found or not text-based');
            }

            const existing = await channel.fetchWebhooks();
            const webhook = existing.first() || await channel.createWebhook({
                name: options.name || 'EyeDaemon Webhook',
                avatar: options.avatar,
            });

            const url = webhook.url;
            this.webhook_cache.set(channel_id, url);
            return url;
        } catch (error) {
            logger.error('Failed to get or create webhook', { error: error.message, channel_id });
            throw new DatabaseError('Failed to get or create webhook', { originalError: error.message });
        }
    }

    /**
     * Send payload to webhook URL
     * @param {string} webhook_url - Webhook URL
     * @param {Object} payload - Payload body
     * @returns {Promise<void>}
     */
    async send(webhook_url, payload) {
        try {
            const response = await fetch(webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Webhook responded with ${response.status}`);
            }
        } catch (error) {
            logger.warn('Failed to send webhook payload', { error: error.message });
            throw new DatabaseError('Failed to send webhook payload', { originalError: error.message });
        }
    }

    /**
     * Send structured integration message
     * @param {string} channel_id - Channel ID
     * @param {Object} data - { title, description, fields, color }
     * @returns {Promise<void>}
     */
    async send_integration_message(channel_id, data) {
        try {
            const url = await this.get_or_create(channel_id, { name: 'EyeDaemon Integrations' });
            const embed_builder = this.client.embedBuilder;
            const embed = embed_builder?.create({
                title: data.title,
                description: data.description,
                color: data.color || 0x0099ff,
                fields: data.fields || [],
                timestamp: new Date(),
            })?.data || {};

            await this.send(url, { embeds: [embed] });
        } catch (error) {
            logger.error('Failed to send integration message', { error: error.message, channel_id });
        }
    }
}

module.exports = WebhookService;
