/**
 * Format Helper
 * 
 * Utility functions for formatting data for display
 */

/**
 * Format milliseconds to readable time string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted time string (HH:MM:SS or MM:SS)
 */
function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Create a progress bar for track playback
 * @param {number} current - Current position in milliseconds
 * @param {number} total - Total duration in milliseconds
 * @param {number} size - Length of the progress bar (default: 20)
 * @returns {string} Progress bar string
 */
function progressBar(current, total, size = 20) {
    const progress = Math.floor((current / total) * size);
    const bar = '▬'.repeat(progress) + '🔘' + '▬'.repeat(size - progress);
    return bar;
}

module.exports = {
    formatDuration,
    progressBar
};
