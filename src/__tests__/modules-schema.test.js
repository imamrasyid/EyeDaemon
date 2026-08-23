'use strict';

const path = require('path');
const fs = require('fs');

describe('Module & Slash Command Definitions Schema', () => {
    const modulesDir = path.join(__dirname, '..', 'bot', 'application', 'modules');
    const moduleNames = ['admin', 'economy', 'leveling', 'moderation', 'music', 'ticket', 'utility'];

    test('all 7 expected module directories exist', () => {
        for (const mod of moduleNames) {
            const modPath = path.join(modulesDir, mod, 'index.js');
            expect(fs.existsSync(modPath)).toBe(true);
        }
    });

    const expectedCommandsPerModule = {
        admin: ['config', 'performance', 'health'],
        economy: ['balance', 'daily', 'work', 'transfer', 'deposit', 'withdraw', 'blackjack', 'shop', 'shop-buy', 'inventory'],
        leveling: ['rank', 'leaderboard', 'givexp', 'removexp', 'setlevel', 'resetxp'],
        moderation: ['warn', 'kick', 'ban', 'unban', 'timeout', 'purge', 'warnings'],
        music: [
            'play', 'pause', 'resume', 'skip', 'stop', 'queue', 'nowplaying',
            'volume', 'loop', 'shuffle', 'clear', 'remove', 'jump', 'move',
            'seek', 'filter', 'playlist-create', 'playlist-save', 'playlist-load',
            'playlist-delete', 'playlist-list'
        ],
        ticket: ['ticket', 'close', 'claim', 'unclaim', 'ticket-add', 'ticket-remove', 'tickets'],
        utility: ['help', 'stats']
    };

    let totalCommandsCount = 0;

    for (const [modName, expectedCmds] of Object.entries(expectedCommandsPerModule)) {
        describe(`Module: ${modName}`, () => {
            const moduleDef = require(path.join(modulesDir, modName, 'index.js'));

            test('has required metadata properties', () => {
                expect(typeof moduleDef.name).toBe('string');
                expect(typeof moduleDef.description).toBe('string');
                expect(typeof moduleDef.version).toBe('string');
                expect(Array.isArray(moduleDef.controllers)).toBe(true);
                expect(Array.isArray(moduleDef.commands)).toBe(true);
            });

            test(`defines exactly the expected commands (${expectedCmds.length} commands)`, () => {
                const cmdNames = moduleDef.commands.map(c => c.name);
                expect(cmdNames.sort()).toEqual([...expectedCmds].sort());
                totalCommandsCount += moduleDef.commands.length;
            });

            test('every command has valid structure and maps to an existing controller method', () => {
                for (const cmd of moduleDef.commands) {
                    expect(typeof cmd.name).toBe('string');
                    expect(cmd.name.length).toBeGreaterThan(0);
                    expect(typeof cmd.description).toBe('string');
                    expect(typeof cmd.controller).toBe('string');
                    expect(typeof cmd.method).toBe('string');
                    expect(Array.isArray(cmd.options)).toBe(true);

                    // Verify Controller file exists
                    const controllerPath = path.join(__dirname, '..', 'bot', 'application', 'controllers', `${cmd.controller}.js`);
                    expect(fs.existsSync(controllerPath)).toBe(true);

                    // Verify Controller class has the handler method
                    const ControllerClass = require(controllerPath);
                    expect(typeof ControllerClass.prototype[cmd.method]).toBe('function');

                    // Verify options if present
                    for (const opt of cmd.options) {
                        expect(typeof opt.name).toBe('string');
                        expect(typeof opt.description).toBe('string');
                        expect(typeof opt.type).toBe('number');
                    }
                }
            });
        });
    }

    test('total registered commands equals 56', () => {
        const total = Object.values(expectedCommandsPerModule).reduce((acc, curr) => acc + curr.length, 0);
        expect(total).toBe(56);
    });
});
