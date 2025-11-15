/**
 * Economy Module Definition
 * 
 * Defines the economy module structure with all commands and their mappings
 * to the EconomyController methods
 */

module.exports = {
    name: 'Economy',
    description: 'Currency system with games and transactions',
    version: '1.0.0',

    // Controllers used by this module
    controllers: ['EconomyController'],

    // Models used by this module
    models: ['EconomyModel'],

    // Services used by this module
    services: ['EconomyService', 'GameService', 'ShopService'],

    // Libraries used by this module
    libraries: [],

    // Command definitions with Discord slash command structure
    commands: [
        {
            name: 'balance',
            description: 'Check your or another user\'s balance',
            controller: 'EconomyController',
            method: 'balance',
            options: [
                {
                    name: 'user',
                    description: 'User to check balance for',
                    type: 6, // USER
                    required: false,
                },
            ],
        },
        {
            name: 'daily',
            description: 'Claim your daily reward',
            controller: 'EconomyController',
            method: 'daily',
            options: [],
        },
        {
            name: 'work',
            description: 'Work to earn money',
            controller: 'EconomyController',
            method: 'work',
            options: [],
        },
        {
            name: 'transfer',
            description: 'Transfer money to another user',
            controller: 'EconomyController',
            method: 'transfer',
            options: [
                {
                    name: 'user',
                    description: 'User to transfer money to',
                    type: 6, // USER
                    required: true,
                },
                {
                    name: 'amount',
                    description: 'Amount to transfer',
                    type: 4, // INTEGER
                    required: true,
                    min_value: 1,
                },
            ],
        },
        {
            name: 'deposit',
            description: 'Deposit money to your bank',
            controller: 'EconomyController',
            method: 'deposit',
            options: [
                {
                    name: 'amount',
                    description: 'Amount to deposit',
                    type: 4, // INTEGER
                    required: true,
                    min_value: 1,
                },
            ],
        },
        {
            name: 'withdraw',
            description: 'Withdraw money from your bank',
            controller: 'EconomyController',
            method: 'withdraw',
            options: [
                {
                    name: 'amount',
                    description: 'Amount to withdraw',
                    type: 4, // INTEGER
                    required: true,
                    min_value: 1,
                },
            ],
        },
        {
            name: 'blackjack',
            description: 'Play a game of blackjack',
            controller: 'EconomyController',
            method: 'blackjack',
            options: [
                {
                    name: 'bet',
                    description: 'Amount to bet',
                    type: 4, // INTEGER
                    required: true,
                    min_value: 10,
                },
            ],
        },
        {
            name: 'shop',
            description: 'View the server shop',
            controller: 'EconomyController',
            method: 'shop',
            options: [],
        },
        {
            name: 'shop-buy',
            description: 'Buy an item from the shop',
            controller: 'EconomyController',
            method: 'shopBuy',
            options: [
                {
                    name: 'item',
                    description: 'Item name or ID',
                    type: 3, // STRING
                    required: true,
                },
                {
                    name: 'quantity',
                    description: 'Quantity to buy',
                    type: 4, // INTEGER
                    required: false,
                    min_value: 1,
                },
            ],
        },
        {
            name: 'inventory',
            description: 'View your inventory',
            controller: 'EconomyController',
            method: 'inventory',
            options: [
                {
                    name: 'user',
                    description: 'User to check inventory for',
                    type: 6, // USER
                    required: false,
                },
            ],
        },
    ],
};
