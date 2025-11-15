module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/bot/index.js',
        '!src/server/server.js',
        '!src/bot/migrations/**',
        '!src/bot/scripts/**',
        '!**/node_modules/**'
    ],
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70
        }
    },
    testMatch: [
        '**/tests/**/*.test.js',
        '**/tests/**/*.spec.js'
    ],
    verbose: true,
    testTimeout: 10000
};
