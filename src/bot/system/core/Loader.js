/**
 * Loader Class
 * 
 * Provides dynamic loading of models, libraries, and helpers with caching.
 * Inspired by CodeIgniter's loader pattern.
 */

class Loader {
    /**
     * Create a new Loader instance
     * @param {Object} instance - The parent instance (Controller or Model)
     */
    constructor(instance) {
        this.instance = instance;

        // Caching mechanism for loaded components
        this.models = new Map();
        this.libraries = new Map();
        this.helpers = new Set();
    }

    /**
     * Load a model
     * @param {string} name - Model name (e.g., 'MusicModel')
     * @returns {Object} Model instance
     */
    model(name) {
        // Return cached model if already loaded
        if (this.models.has(name)) {
            return this.models.get(name);
        }

        try {
            // Load model class from application/models
            const ModelClass = require(`../../application/models/${name}`);

            // Create instance and cache it
            const modelInstance = new ModelClass(this.instance);
            this.models.set(name, modelInstance);

            return modelInstance;
        } catch (error) {
            throw new Error(`Failed to load model '${name}': ${error.message}`);
        }
    }

    /**
     * Load a library
     * @param {string} name - Library name (e.g., 'VoiceManager')
     * @param {Object} params - Optional parameters to pass to library constructor
     * @returns {Object} Library instance
     */
    library(name, params = {}) {
        // Return cached library if already loaded
        if (this.libraries.has(name)) {
            return this.libraries.get(name);
        }

        try {
            // Load library class from system/libraries
            const LibraryClass = require(`../libraries/${name}`);

            // Create instance with params and cache it
            const libraryInstance = new LibraryClass(this.instance, params);
            this.libraries.set(name, libraryInstance);

            return libraryInstance;
        } catch (error) {
            throw new Error(`Failed to load library '${name}': ${error.message}`);
        }
    }

    /**
     * Load a helper
     * @param {string} name - Helper name (e.g., 'format' for format_helper.js)
     */
    helper(name) {
        // Skip if already loaded
        if (this.helpers.has(name)) {
            return;
        }

        try {
            // Load helper file from system/helpers
            require(`../helpers/${name}_helper`);

            // Mark as loaded
            this.helpers.add(name);
        } catch (error) {
            throw new Error(`Failed to load helper '${name}': ${error.message}`);
        }
    }

    /**
     * Clear all cached components
     * Useful for testing or memory management
     */
    clearCache() {
        this.models.clear();
        this.libraries.clear();
        this.helpers.clear();
    }

    /**
     * Check if a model is loaded
     * @param {string} name - Model name
     * @returns {boolean}
     */
    isModelLoaded(name) {
        return this.models.has(name);
    }

    /**
     * Check if a library is loaded
     * @param {string} name - Library name
     * @returns {boolean}
     */
    isLibraryLoaded(name) {
        return this.libraries.has(name);
    }

    /**
     * Check if a helper is loaded
     * @param {string} name - Helper name
     * @returns {boolean}
     */
    isHelperLoaded(name) {
        return this.helpers.has(name);
    }
}

module.exports = Loader;
