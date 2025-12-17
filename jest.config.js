module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/bot/index.js',
        '!src/server/server.js',
        '!src/bot/migrations/**',
        '!src/bot/scripts/**',
        '!**/node_modules/**',
        '!**/__tests__/**'
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
        '**/__tests__/**/*.test.js',
        '**/__tests__/**/*.spec.js',
        '**/tests/**/*.test.js',
        '**/tests/**/*.spec.js'
    ],
    verbose: true,
    testTimeout: 30000, // Increased for property-based tests
    maxWorkers: '50%', // Limit workers for concurrent tests
    setupFilesAfterEnv: ['<rootDir>/src/bot/__tests__/setup.js']
};
