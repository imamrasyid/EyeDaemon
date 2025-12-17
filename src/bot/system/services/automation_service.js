/**
 * Automation Service
 * 
 * Handles scheduled jobs, reminders, and automated tasks
 */

const { Collection } = require('discord.js');
const logger = require('../helpers/logger_helper');

class AutomationService {
    /**
     * Create a new AutomationService instance
     * @param {Object} client - Discord client instance
     */
    constructor(client) {
        this.client = client;
        this.database = client.database;
        this.jobs = new Collection();
        this.reminders = new Collection();
        this.timers = new Collection();
    }

    /**
     * Schedule a job
     * @param {string} job_id - Unique job identifier
     * @param {Function} job_function - Function to execute
     * @param {string|number} schedule - Cron expression or interval in ms
     * @param {Object} options - Job options
     * @returns {Promise<void>}
     */
    async schedule_job(job_id, job_function, schedule, options = {}) {
        try {
            // Parse schedule
            let interval_ms = null;
            if (typeof schedule === 'number') {
                interval_ms = schedule;
            } else if (typeof schedule === 'string') {
                // Basic cron parsing (simplified)
                interval_ms = this._parse_cron(schedule);
            }

            if (!interval_ms) {
                throw new Error('Invalid schedule format');
            }

            // Create job
            const job = {
                id: job_id,
                function: job_function,
                interval: interval_ms,
                last_run: null,
                next_run: Date.now() + interval_ms,
                enabled: options.enabled !== false,
                max_runs: options.max_runs || null,
                run_count: 0,
            };

            this.jobs.set(job_id, job);

            // Start job timer
            this._start_job_timer(job_id);

            logger.info(`Scheduled job: ${job_id} (interval: ${interval_ms}ms)`);
        } catch (error) {
            logger.error('Failed to schedule job', {
                error: error.message,
                job_id,
            });
            throw error;
        }
    }

    /**
     * Cancel a scheduled job
     * @param {string} job_id - Job identifier
     * @returns {void}
     */
    cancel_job(job_id) {
        const job = this.jobs.get(job_id);
        if (!job) {
            return;
        }

        if (job.timer) {
            clearTimeout(job.timer);
        }

        this.jobs.delete(job_id);
        logger.info(`Cancelled job: ${job_id}`);
    }

    /**
     * Create a reminder
     * @param {string} reminder_id - Unique reminder identifier
     * @param {string} user_id - User ID
     * @param {string} channel_id - Channel ID
     * @param {string} message - Reminder message
     * @param {Date|number} remind_at - When to remind (Date or timestamp)
     * @returns {Promise<void>}
     */
    async create_reminder(reminder_id, user_id, channel_id, message, remind_at) {
        try {
            const remind_timestamp = remind_at instanceof Date ? remind_at.getTime() : remind_at;
            const now = Date.now();

            if (remind_timestamp <= now) {
                throw new Error('Reminder time must be in the future');
            }

            const reminder = {
                id: reminder_id,
                user_id,
                channel_id,
                message,
                remind_at: remind_timestamp,
                created_at: now,
            };

            this.reminders.set(reminder_id, reminder);

            // Schedule reminder
            const delay = remind_timestamp - now;
            const timer = setTimeout(async () => {
                await this._execute_reminder(reminder_id);
            }, delay);

            reminder.timer = timer;

            logger.info(`Created reminder: ${reminder_id} (in ${delay}ms)`);
        } catch (error) {
            logger.error('Failed to create reminder', {
                error: error.message,
                reminder_id,
            });
            throw error;
        }
    }

    /**
     * Cancel a reminder
     * @param {string} reminder_id - Reminder identifier
     * @returns {void}
     */
    cancel_reminder(reminder_id) {
        const reminder = this.reminders.get(reminder_id);
        if (!reminder) {
            return;
        }

        if (reminder.timer) {
            clearTimeout(reminder.timer);
        }

        this.reminders.delete(reminder_id);
        logger.info(`Cancelled reminder: ${reminder_id}`);
    }

    /**
     * Start job timer
     * @param {string} job_id - Job identifier
     * @private
     */
    _start_job_timer(job_id) {
        const job = this.jobs.get(job_id);
        if (!job || !job.enabled) {
            return;
        }

        const delay = job.next_run - Date.now();
        if (delay <= 0) {
            // Execute immediately
            this._execute_job(job_id);
            return;
        }

        job.timer = setTimeout(async () => {
            await this._execute_job(job_id);
        }, delay);
    }

    /**
     * Execute a job
     * @param {string} job_id - Job identifier
     * @private
     */
    async _execute_job(job_id) {
        const job = this.jobs.get(job_id);
        if (!job || !job.enabled) {
            return;
        }

        try {
            await job.function();
            job.last_run = Date.now();
            job.run_count++;

            // Check max runs
            if (job.max_runs && job.run_count >= job.max_runs) {
                this.cancel_job(job_id);
                return;
            }

            // Schedule next run
            job.next_run = Date.now() + job.interval;
            this._start_job_timer(job_id);
        } catch (error) {
            logger.error('Job execution failed', {
                error: error.message,
                job_id,
            });
        }
    }

    /**
     * Execute a reminder
     * @param {string} reminder_id - Reminder identifier
     * @private
     */
    async _execute_reminder(reminder_id) {
        const reminder = this.reminders.get(reminder_id);
        if (!reminder) {
            return;
        }

        try {
            const channel = await this.client.channels.fetch(reminder.channel_id);
            if (!channel) {
                throw new Error('Channel not found');
            }

            await channel.send(
                `🔔 <@${reminder.user_id}> Reminder: ${reminder.message}`
            );

            this.reminders.delete(reminder_id);
        } catch (error) {
            logger.error('Reminder execution failed', {
                error: error.message,
                reminder_id,
            });
        }
    }

    /**
     * Parse cron expression (simplified)
     * @param {string} cron - Cron expression
     * @returns {number} Interval in milliseconds
     * @private
     */
    _parse_cron(cron) {
        // Simplified cron parser
        // Format: "every X minutes/hours/days"
        // Or standard cron: "*/5 * * * *" (every 5 minutes)

        // For now, return a default interval
        // Full cron parsing would require a library
        return 60000; // 1 minute default
    }

    /**
     * Get all active jobs
     * @returns {Array} Active jobs
     */
    get_active_jobs() {
        return Array.from(this.jobs.values()).filter((job) => job.enabled);
    }

    /**
     * Get all active reminders
     * @returns {Array} Active reminders
     */
    get_active_reminders() {
        return Array.from(this.reminders.values());
    }

    /**
     * Shutdown automation service
     * @returns {void}
     */
    shutdown() {
        // Cancel all jobs
        for (const job_id of this.jobs.keys()) {
            this.cancel_job(job_id);
        }

        // Cancel all reminders
        for (const reminder_id of this.reminders.keys()) {
            this.cancel_reminder(reminder_id);
        }

        logger.info('Automation service shutdown');
    }
}

module.exports = AutomationService;
