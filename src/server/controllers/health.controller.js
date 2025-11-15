/**
 * HealthController
 * 
 * Controller for health check and monitoring endpoints.
 * Verifies availability of external dependencies (yt-dlp, ffmpeg).
 * 
 * Requirements: 7.1, 7.2, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5
 */
const BaseController = require('./base.controller');
const { spawn } = require('child_process');

class HealthController extends BaseController {
    /**
     * Create a new HealthController
     * @param {Object} services - Services to inject (ytdlpProvider, ffmpegProvider, healthCheckService)
     */
    constructor(services) {
        super(services);
        this.healthCheckService = services.healthCheckService || null;
    }

    /**
     * Handle health check endpoint
     * GET /health
     * 
     * Returns detailed health status including dependency availability
     * 
     * @param {Request} req - Express request object
     * @param {Response} res - Express response object
     * @param {Function} next - Express next middleware function
     */
    async check(req, res, next) {
        try {
            const startTime = Date.now();

            // Check all dependencies in parallel
            const checks = [
                this.checkYtdlp(),
                this.checkFfmpeg(),
            ];

            // Add bot health check if service is available
            if (this.healthCheckService) {
                checks.push(this.checkBotHealth());
            }

            const results = await Promise.all(checks);
            const [ytdlpStatus, ffmpegStatus, botHealth] = results;

            const duration = Date.now() - startTime;

            // Determine overall health status
            let isHealthy = ytdlpStatus.available && ffmpegStatus.available;

            // Include bot health in overall status if available
            if (botHealth) {
                isHealthy = isHealthy && (botHealth.status === 'healthy' || botHealth.status === 'degraded');
            }

            const healthData = {
                status: isHealthy ? 'healthy' : 'unhealthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                duration,
                dependencies: {
                    ytdlp: ytdlpStatus,
                    ffmpeg: ffmpegStatus,
                },
            };

            // Add bot health data if available
            if (botHealth) {
                healthData.bot = botHealth;
            }

            // Return appropriate status code
            const statusCode = isHealthy ? 200 : 503;

            return res.status(statusCode).json({
                success: isHealthy,
                data: healthData,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Check bot health using HealthCheckService
     * @returns {Promise<Object>} Bot health status
     */
    async checkBotHealth() {
        try {
            if (!this.healthCheckService) {
                return {
                    status: 'skipped',
                    message: 'Bot health check service not available',
                };
            }

            const health = await this.healthCheckService.checkHealth();
            return health;
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                message: 'Failed to check bot health',
            };
        }
    }

    /**
     * Check yt-dlp availability
     * @returns {Promise<Object>} Status object with availability and version info
     */
    async checkYtdlp() {
        const ytdlpProvider = this.getService('ytdlpProvider');
        const ytdlpPath = ytdlpProvider.ytdlpPath;

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({
                    available: false,
                    error: 'Health check timeout',
                });
            }, 5000); // 5 second timeout

            const process = spawn(ytdlpPath, ['--version']);

            let output = '';
            let errorOutput = '';

            process.stdout.on('data', (data) => {
                output += data.toString();
            });

            process.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            process.on('close', (code) => {
                clearTimeout(timeout);

                if (code === 0) {
                    resolve({
                        available: true,
                        version: output.trim(),
                        path: ytdlpPath,
                    });
                } else {
                    resolve({
                        available: false,
                        error: errorOutput || 'Failed to execute yt-dlp',
                        path: ytdlpPath,
                    });
                }
            });

            process.on('error', (error) => {
                clearTimeout(timeout);
                resolve({
                    available: false,
                    error: error.message,
                    path: ytdlpPath,
                });
            });
        });
    }

    /**
     * Check ffmpeg availability
     * @returns {Promise<Object>} Status object with availability and version info
     */
    async checkFfmpeg() {
        const ffmpegProvider = this.getService('ffmpegProvider');
        const ffmpegPath = ffmpegProvider.ffmpegPath;

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({
                    available: false,
                    error: 'Health check timeout',
                });
            }, 5000); // 5 second timeout

            const process = spawn(ffmpegPath, ['-version']);

            let output = '';
            let errorOutput = '';

            process.stdout.on('data', (data) => {
                output += data.toString();
            });

            process.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            process.on('close', (code) => {
                clearTimeout(timeout);

                if (code === 0) {
                    // Extract version from first line
                    const versionLine = output.split('\n')[0];
                    resolve({
                        available: true,
                        version: versionLine.trim(),
                        path: ffmpegPath,
                    });
                } else {
                    resolve({
                        available: false,
                        error: errorOutput || 'Failed to execute ffmpeg',
                        path: ffmpegPath,
                    });
                }
            });

            process.on('error', (error) => {
                clearTimeout(timeout);
                resolve({
                    available: false,
                    error: error.message,
                    path: ffmpegPath,
                });
            });
        });
    }
}

module.exports = HealthController;
