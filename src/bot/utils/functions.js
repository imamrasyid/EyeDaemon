/**
 * Utility functions for the bot
 */

/**
 * Format duration from milliseconds to human readable format
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format file size from bytes to human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Parse time string to milliseconds
 * @param {string} timeString - Time string (e.g., "1h 30m", "2d", "45s")
 * @returns {number} Time in milliseconds
 */
function parseTime(timeString) {
  const regex = /(\d+)\s*(s|m|h|d)/gi;
  let totalMs = 0;
  let match;

  while ((match = regex.exec(timeString)) !== null) {
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 's':
        totalMs += value * 1000;
        break;
      case 'm':
        totalMs += value * 60 * 1000;
        break;
      case 'h':
        totalMs += value * 60 * 60 * 1000;
        break;
      case 'd':
        totalMs += value * 24 * 60 * 60 * 1000;
        break;
    }
  }

  return totalMs;
}

/**
 * Generate random string
 * @param {number} length - Length of the random string
 * @param {string} charset - Character set to use
 * @returns {string} Random string
 */
function generateRandomString(length = 8, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

/**
 * Generate random number between min and max
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random number
 */
function generateRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Shuffle array using Fisher-Yates algorithm
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Truncate string to specified length
 * @param {string} str - String to truncate
 * @param {number} length - Maximum length
 * @param {string} suffix - Suffix to add
 * @returns {string} Truncated string
 */
function truncateString(str, length = 100, suffix = '...') {
  if (str.length <= length) return str;
  return str.substring(0, length - suffix.length) + suffix;
}

/**
 * Escape markdown characters in string
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeMarkdown(text) {
  return text.replace(/[*_`~|\\]/g, '\\$&');
}

/**
 * Create progress bar
 * @param {number} current - Current value
 * @param {number} total - Total value
 * @param {number} length - Bar length
 * @param {string} filled - Filled character
 * @param {string} empty - Empty character
 * @returns {string} Progress bar
 */
function createProgressBar(current, total, length = 20, filled = '█', empty = '░') {
  const percentage = Math.min(current / total, 1);
  const filledLength = Math.round(length * percentage);
  const emptyLength = length - filledLength;
  
  return filled.repeat(filledLength) + empty.repeat(emptyLength);
}

/**
 * Calculate XP required for level
 * @param {number} level - Target level
 * @param {number} baseXP - Base XP for level 1
 * @param {number} multiplier - XP multiplier
 * @returns {number} XP required
 */
function calculateXPForLevel(level, baseXP = 100, multiplier = 1.5) {
  return Math.floor(baseXP * Math.pow(multiplier, level - 1));
}

/**
 * Calculate level from total XP
 * @param {number} totalXP - Total XP
 * @param {number} baseXP - Base XP for level 1
 * @param {number} multiplier - XP multiplier
 * @returns {number} Current level
 */
function calculateLevelFromXP(totalXP, baseXP = 100, multiplier = 1.5) {
  let level = 1;
  let xpForNextLevel = baseXP;
  
  while (totalXP >= xpForNextLevel) {
    totalXP -= xpForNextLevel;
    level++;
    xpForNextLevel = calculateXPForLevel(level, baseXP, multiplier);
  }
  
  return level;
}

/**
 * Get progress to next level
 * @param {number} totalXP - Total XP
 * @param {number} baseXP - Base XP for level 1
 * @param {number} multiplier - XP multiplier
 * @returns {Object} Progress information
 */
function getLevelProgress(totalXP, baseXP = 100, multiplier = 1.5) {
  const currentLevel = calculateLevelFromXP(totalXP, baseXP, multiplier);
  const xpForCurrentLevel = calculateXPForLevel(currentLevel, baseXP, multiplier);
  const xpForPreviousLevels = currentLevel > 1 ? 
    Array.from({ length: currentLevel - 1 }, (_, i) => calculateXPForLevel(i + 1, baseXP, multiplier))
      .reduce((sum, xp) => sum + xp, 0) : 0;
  
  const xpInCurrentLevel = totalXP - xpForPreviousLevels;
  const progress = xpInCurrentLevel / xpForCurrentLevel;
  
  return {
    level: currentLevel,
    xpInCurrentLevel,
    xpForCurrentLevel,
    progress,
    percentage: Math.floor(progress * 100)
  };
}

/**
 * Deep clone object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
}

/**
 * Wait for specified milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} Promise that resolves after specified time
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

module.exports = {
  formatDuration,
  formatFileSize,
  parseTime,
  generateRandomString,
  generateRandomNumber,
  shuffleArray,
  truncateString,
  escapeMarkdown,
  createProgressBar,
  calculateXPForLevel,
  calculateLevelFromXP,
  getLevelProgress,
  deepClone,
  sleep,
  debounce,
  throttle
};