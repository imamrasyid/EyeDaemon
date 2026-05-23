describe('dependency smoke checks', () => {
    test('loads runtime server dependencies', () => {
        expect(typeof require('cors')).toBe('function');
        expect(typeof require('helmet')).toBe('function');
        expect(typeof require('express-rate-limit')).toBe('function');
    });

    test('loads bot dependency exports used by the application', () => {
        const { IntentsBitField, MessageFlags } = require('discord.js');
        const { randomUUID } = require('crypto');

        expect(IntentsBitField.Flags.Guilds).toBeDefined();
        expect(MessageFlags.Ephemeral).toBe(64);
        expect(typeof randomUUID).toBe('function');
        expect(typeof require('axios').get).toBe('function');
    });

    test('loads local modules without starting long-running processes', () => {
        expect(typeof require('../server/app')).toBe('function');
        expect(typeof require('../bot/bootstrap')).toBe('function');
        expect(require('../bot/migrations/0001_initial_schema').name).toBe('0001_initial_schema');
    });
});
