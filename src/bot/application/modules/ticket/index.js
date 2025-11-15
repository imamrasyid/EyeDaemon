/**
 * Ticket Module Definition
 * 
 * Defines the ticket module structure with all commands and their mappings
 * to the TicketController methods
 */

module.exports = {
    name: 'Ticket',
    description: 'Support ticket system',
    version: '1.0.0',

    // Controllers used by this module
    controllers: ['TicketController'],

    // Models used by this module
    models: ['TicketModel'],

    // Libraries used by this module
    libraries: [],

    // Command definitions with Discord slash command structure
    commands: [
        {
            name: 'ticket',
            description: 'Create a new support ticket',
            controller: 'TicketController',
            method: 'ticket',
            options: [
                {
                    name: 'category',
                    description: 'Ticket category',
                    type: 3, // STRING
                    required: false,
                    choices: [
                        { name: 'General', value: 'general' },
                        { name: 'Technical', value: 'technical' },
                        { name: 'Billing', value: 'billing' },
                        { name: 'Report', value: 'report' },
                        { name: 'Other', value: 'other' },
                    ],
                },
                {
                    name: 'description',
                    description: 'Ticket description',
                    type: 3, // STRING
                    required: false,
                },
            ],
        },
        {
            name: 'close',
            description: 'Close the current ticket',
            controller: 'TicketController',
            method: 'close',
            options: [],
        },
        {
            name: 'claim',
            description: 'Claim a ticket (Staff only)',
            controller: 'TicketController',
            method: 'claim',
            options: [],
        },
        {
            name: 'unclaim',
            description: 'Unclaim a ticket (Staff only)',
            controller: 'TicketController',
            method: 'unclaim',
            options: [],
        },
        {
            name: 'ticket-add',
            description: 'Add a user to the ticket',
            controller: 'TicketController',
            method: 'add',
            options: [
                {
                    name: 'user',
                    description: 'User to add',
                    type: 6, // USER
                    required: true,
                },
            ],
        },
        {
            name: 'ticket-remove',
            description: 'Remove a user from the ticket',
            controller: 'TicketController',
            method: 'remove',
            options: [
                {
                    name: 'user',
                    description: 'User to remove',
                    type: 6, // USER
                    required: true,
                },
            ],
        },
        {
            name: 'tickets',
            description: 'List all tickets (Staff only)',
            controller: 'TicketController',
            method: 'tickets',
            options: [
                {
                    name: 'status',
                    description: 'Ticket status',
                    type: 3, // STRING
                    required: false,
                    choices: [
                        { name: 'Open', value: 'open' },
                        { name: 'Closed', value: 'closed' },
                    ],
                },
            ],
        },
    ],
};
