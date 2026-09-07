'use strict';

/**
 * Admin Module Constants
 *
 * Centralized display names, labels, and formatting rules for the admin module.
 * Single source of truth for all UI-related strings and display logic.
 */

const CATEGORY_LABELS = {
    general: '📋 General Settings',
    music: '🎵 Music Settings',
    welcome: '👋 Welcome & Goodbye Settings',
    moderation: '🛡️ Moderation Settings',
    leveling: '📈 Leveling Settings',
    economy: '💰 Economy Settings',
    logging: '📝 Logging Settings',
    roles: '🎭 Role Configuration',
    features: '🎛️ Feature Toggles',
};

const STATUS_LABELS = {
    enabled: '✅ Enabled',
    disabled: '❌ Disabled',
    notSet: 'Not set',
};

const HEALTH_STATUS = {
    healthy: { emoji: '✅', label: 'Healthy' },
    degraded: { emoji: '⚠️', label: 'Degraded' },
    unhealthy: { emoji: '❌', label: 'Unhealthy' },
    unknown: { emoji: '❓', label: 'Unknown' },
};

/**
 * Format a config value for display based on its setting type.
 * Uses the format hint from the setting registry instead of fragile string matching.
 *
 * @param {string} format - The display format ('role', 'channel', 'boolean', 'number', 'text')
 * @param {*} value - The raw config value
 * @returns {string} Formatted display string
 */
function formatConfigValue(format, value) {
    if (value === null || value === undefined) {
        return STATUS_LABELS.notSet;
    }

    switch (format) {
        case 'role':
            return `<@&${value}>`;
        case 'channel':
            return `<#${value}>`;
        case 'boolean':
            return value ? STATUS_LABELS.enabled : STATUS_LABELS.disabled;
        case 'number':
            return `\`${value}\``;
        default:
            return `\`${value}\``;
    }
}

module.exports = {
    CATEGORY_LABELS,
    STATUS_LABELS,
    HEALTH_STATUS,
    formatConfigValue,
};
