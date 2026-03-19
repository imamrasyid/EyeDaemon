/**
 * AutoModService
 *
 * Stub for automated moderation service.
 * Extend this class to implement auto-moderation rules (spam, links, bad words, etc.)
 */

const BaseService = require('../../../../system/core/BaseService');

class AutoModService extends BaseService {
    constructor(client, options = {}) {
        super(client, options);
    }

    async initialize() {
        await super.initialize();
        this.log('AutoModService initialized', 'info');
    }
}

module.exports = AutoModService;
