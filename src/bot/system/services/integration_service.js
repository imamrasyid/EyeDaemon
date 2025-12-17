/**
 * Integration Service
 *
 * Handles external integrations (GitHub, GitLab, CI/CD, monitoring alerts, payments).
 * Provides lightweight hooks and placeholder handlers for future expansion.
 */

const logger = require('../helpers/logger_helper');

class IntegrationService {
    constructor(client) {
        this.client = client;
        this.webhookService = client.webhookService;
    }

    /**
     * Handle GitHub webhook payload
     * @param {Object} payload - GitHub event payload
     * @param {string} channel_id - Channel to post summary
     */
    async handle_github_payload(payload, channel_id) {
        try {
            if (!payload) return;
            const action = payload.action || 'event';
            const repo = payload.repository?.full_name || 'unknown';
            const title = `GitHub ${action}`;
            const description = payload.pull_request?.title || payload.issue?.title || payload.head_commit?.message || 'New activity';

            await this.webhookService?.send_integration_message(channel_id, {
                title,
                description,
                fields: [
                    { name: 'Repository', value: repo, inline: true },
                    { name: 'Sender', value: payload.sender?.login || 'unknown', inline: true },
                ],
            });
        } catch (error) {
            logger.error('Failed to handle GitHub payload', { error: error.message });
        }
    }

    /**
     * Handle GitLab webhook payload
     */
    async handle_gitlab_payload(payload, channel_id) {
        try {
            if (!payload) return;
            const title = payload.object_kind ? `GitLab ${payload.object_kind}` : 'GitLab event';
            const description = payload.object_attributes?.title || payload.object_attributes?.description || 'New activity';
            await this.webhookService?.send_integration_message(channel_id, {
                title,
                description,
                fields: [
                    { name: 'Project', value: payload.project?.path_with_namespace || 'unknown', inline: true },
                    { name: 'User', value: payload.user_username || 'unknown', inline: true },
                ],
            });
        } catch (error) {
            logger.error('Failed to handle GitLab payload', { error: error.message });
        }
    }

    /**
     * Handle CI/CD notifications (generic)
     */
    async handle_ci_notification(data, channel_id) {
        try {
            const status = data.status || 'unknown';
            const pipeline = data.pipeline || 'pipeline';
            await this.webhookService?.send_integration_message(channel_id, {
                title: `CI/CD: ${status}`,
                description: data.description || 'Pipeline update',
                fields: [
                    { name: 'Pipeline', value: pipeline, inline: true },
                    { name: 'Duration', value: `${data.duration || '-'}s`, inline: true },
                ],
                color: status === 'success' ? 0x00c853 : status === 'failed' ? 0xd32f2f : 0xffb300,
            });
        } catch (error) {
            logger.error('Failed to handle CI notification', { error: error.message });
        }
    }

    /**
     * Handle payment webhook (Stripe/others) - placeholder
     */
    async handle_payment_event(data, channel_id) {
        try {
            await this.webhookService?.send_integration_message(channel_id, {
                title: `Payment ${data.type || 'event'}`,
                description: data.summary || 'Payment update',
                fields: [
                    { name: 'Amount', value: data.amount ? `${data.amount}` : '-', inline: true },
                    { name: 'User', value: data.user || 'unknown', inline: true },
                ],
            });
        } catch (error) {
            logger.error('Failed to handle payment event', { error: error.message });
        }
    }
}

module.exports = IntegrationService;
