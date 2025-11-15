/**
 * QueryMetricsTracker
 * 
 * Tracks detailed query execution metrics including percentiles.
 * Monitors performance degradation and provides alerting.
 */

class QueryMetricsTracker {
    /**
     * Create a new QueryMetricsTracker
     * @param {Object} options - Tracker configuration
     */
    constructor(options = {}) {
        this.logger = options.logger || console;
        this.enabled = options.enabled !== false;

        // Thresholds for alerting
        this.thresholds = {
            avgExecutionTime: options.avgThreshold || 500, // ms
            p95ExecutionTime: options.p95Threshold || 1000, // ms
            p99ExecutionTime: options.p99Threshold || 2000, // ms
            degradationPercent: options.degradationPercent || 50 // %
        };

        // Execution time samples (for percentile calculation)
        this.executionTimes = [];
        this.maxSamples = options.maxSamples || 1000;

        // Metrics
        this.metrics = {
            totalQueries: 0,
            totalExecutionTime: 0,
            minExecutionTime: Infinity,
            maxExecutionTime: 0,
            avgExecutionTime: 0,
            p50ExecutionTime: 0,
            p95ExecutionTime: 0,
            p99ExecutionTime: 0,
            lastCalculated: Date.now()
        };

        // Baseline for degradation detection
        this.baseline = null;
        this.degradationAlerts = [];
    }

    /**
     * Record a query execution time
     * @param {number} executionTime - Execution time in milliseconds
     */
    recordExecutionTime(executionTime) {
        if (!this.enabled) {
            return;
        }

        // Update metrics
        this.metrics.totalQueries++;
        this.metrics.totalExecutionTime += executionTime;
        this.metrics.minExecutionTime = Math.min(this.metrics.minExecutionTime, executionTime);
        this.metrics.maxExecutionTime = Math.max(this.metrics.maxExecutionTime, executionTime);
        this.metrics.avgExecutionTime = this.metrics.totalExecutionTime / this.metrics.totalQueries;

        // Add to samples
        this.executionTimes.push(executionTime);

        // Trim samples if too large
        if (this.executionTimes.length > this.maxSamples) {
            this.executionTimes.shift();
        }

        // Recalculate percentiles periodically (every 100 queries)
        if (this.metrics.totalQueries % 100 === 0) {
            this.calculatePercentiles();
            this.checkForDegradation();
        }
    }

    /**
     * Calculate percentile values
     * @private
     */
    calculatePercentiles() {
        if (this.executionTimes.length === 0) {
            return;
        }

        // Sort execution times
        const sorted = [...this.executionTimes].sort((a, b) => a - b);
        const len = sorted.length;

        // Calculate percentiles
        this.metrics.p50ExecutionTime = this.getPercentile(sorted, 50);
        this.metrics.p95ExecutionTime = this.getPercentile(sorted, 95);
        this.metrics.p99ExecutionTime = this.getPercentile(sorted, 99);
        this.metrics.lastCalculated = Date.now();
    }

    /**
     * Get percentile value from sorted array
     * @param {Array<number>} sorted - Sorted array of values
     * @param {number} percentile - Percentile to calculate (0-100)
     * @returns {number} Percentile value
     * @private
     */
    getPercentile(sorted, percentile) {
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }

    /**
     * Set baseline metrics for degradation detection
     */
    setBaseline() {
        this.baseline = {
            avgExecutionTime: this.metrics.avgExecutionTime,
            p95ExecutionTime: this.metrics.p95ExecutionTime,
            p99ExecutionTime: this.metrics.p99ExecutionTime,
            timestamp: Date.now()
        };

        this.log('Performance baseline set', 'info', this.baseline);
    }

    /**
     * Check for performance degradation
     * @private
     */
    checkForDegradation() {
        if (!this.baseline) {
            return;
        }

        const alerts = [];

        // Check average execution time
        if (this.baseline.avgExecutionTime > 0) {
            const avgIncrease = ((this.metrics.avgExecutionTime - this.baseline.avgExecutionTime) /
                this.baseline.avgExecutionTime) * 100;

            if (avgIncrease > this.thresholds.degradationPercent) {
                alerts.push({
                    metric: 'avgExecutionTime',
                    baseline: this.baseline.avgExecutionTime,
                    current: this.metrics.avgExecutionTime,
                    increase: `${avgIncrease.toFixed(2)}%`,
                    severity: 'high'
                });
            }
        }

        // Check p95 execution time
        if (this.baseline.p95ExecutionTime > 0) {
            const p95Increase = ((this.metrics.p95ExecutionTime - this.baseline.p95ExecutionTime) /
                this.baseline.p95ExecutionTime) * 100;

            if (p95Increase > this.thresholds.degradationPercent) {
                alerts.push({
                    metric: 'p95ExecutionTime',
                    baseline: this.baseline.p95ExecutionTime,
                    current: this.metrics.p95ExecutionTime,
                    increase: `${p95Increase.toFixed(2)}%`,
                    severity: 'medium'
                });
            }
        }

        // Check p99 execution time
        if (this.baseline.p99ExecutionTime > 0) {
            const p99Increase = ((this.metrics.p99ExecutionTime - this.baseline.p99ExecutionTime) /
                this.baseline.p99ExecutionTime) * 100;

            if (p99Increase > this.thresholds.degradationPercent) {
                alerts.push({
                    metric: 'p99ExecutionTime',
                    baseline: this.baseline.p99ExecutionTime,
                    current: this.metrics.p99ExecutionTime,
                    increase: `${p99Increase.toFixed(2)}%`,
                    severity: 'low'
                });
            }
        }

        // Log alerts
        if (alerts.length > 0) {
            this.degradationAlerts.push(...alerts);
            this.logDegradationAlert(alerts);
        }
    }

    /**
     * Log degradation alert
     * @param {Array<Object>} alerts - Degradation alerts
     * @private
     */
    logDegradationAlert(alerts) {
        const highSeverity = alerts.filter(a => a.severity === 'high');

        if (highSeverity.length > 0) {
            this.log('Performance degradation detected!', 'error', {
                alerts: highSeverity,
                timestamp: new Date().toISOString()
            });
        } else {
            this.log('Performance degradation detected', 'warn', {
                alerts,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Check if metrics exceed thresholds
     * @returns {Array<Object>} Threshold violations
     */
    checkThresholds() {
        const violations = [];

        if (this.metrics.avgExecutionTime > this.thresholds.avgExecutionTime) {
            violations.push({
                metric: 'avgExecutionTime',
                threshold: this.thresholds.avgExecutionTime,
                current: this.metrics.avgExecutionTime,
                severity: 'medium'
            });
        }

        if (this.metrics.p95ExecutionTime > this.thresholds.p95ExecutionTime) {
            violations.push({
                metric: 'p95ExecutionTime',
                threshold: this.thresholds.p95ExecutionTime,
                current: this.metrics.p95ExecutionTime,
                severity: 'high'
            });
        }

        if (this.metrics.p99ExecutionTime > this.thresholds.p99ExecutionTime) {
            violations.push({
                metric: 'p99ExecutionTime',
                threshold: this.thresholds.p99ExecutionTime,
                current: this.metrics.p99ExecutionTime,
                severity: 'high'
            });
        }

        return violations;
    }

    /**
     * Get current metrics
     * @returns {Object} Current metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            sampleCount: this.executionTimes.length,
            thresholds: this.thresholds,
            baseline: this.baseline,
            lastCalculated: new Date(this.metrics.lastCalculated).toISOString()
        };
    }

    /**
     * Get degradation alerts
     * @returns {Array<Object>} Degradation alerts
     */
    getDegradationAlerts() {
        return this.degradationAlerts;
    }

    /**
     * Clear degradation alerts
     */
    clearDegradationAlerts() {
        this.degradationAlerts = [];
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.executionTimes = [];
        this.metrics = {
            totalQueries: 0,
            totalExecutionTime: 0,
            minExecutionTime: Infinity,
            maxExecutionTime: 0,
            avgExecutionTime: 0,
            p50ExecutionTime: 0,
            p95ExecutionTime: 0,
            p99ExecutionTime: 0,
            lastCalculated: Date.now()
        };
        this.degradationAlerts = [];
    }

    /**
     * Generate metrics report
     * @returns {Object} Detailed metrics report
     */
    generateReport() {
        const thresholdViolations = this.checkThresholds();

        return {
            metrics: this.getMetrics(),
            thresholdViolations,
            degradationAlerts: this.degradationAlerts,
            status: thresholdViolations.length === 0 ? 'healthy' : 'degraded',
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Enable metrics tracking
     */
    enable() {
        this.enabled = true;
    }

    /**
     * Disable metrics tracking
     */
    disable() {
        this.enabled = false;
    }

    /**
     * Check if tracking is enabled
     * @returns {boolean} True if enabled
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Log message with context
     * @param {string} message - Log message
     * @param {string} level - Log level
     * @param {Object} metadata - Additional metadata
     * @private
     */
    log(message, level = 'info', metadata = {}) {
        if (this.logger && typeof this.logger[level] === 'function') {
            this.logger[level](`[QueryMetrics] ${message}`, metadata);
        }
    }
}

module.exports = QueryMetricsTracker;
