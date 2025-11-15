/**
 * Core System Classes Index
 * 
 * Exports all core classes for easy importing
 */

const Loader = require('./Loader');
const Controller = require('./Controller');
const Model = require('./Model');
const BaseService = require('./BaseService');
const BaseInteraction = require('./BaseInteraction');
const BaseEvent = require('./BaseEvent');
const {
    BotError,
    VoiceError,
    QueueError,
    AudioError,
    DatabaseError,
    PermissionError,
    ValidationError
} = require('./Errors');

module.exports = {
    Loader,
    Controller,
    Model,
    BaseService,
    BaseInteraction,
    BaseEvent,
    BotError,
    VoiceError,
    QueueError,
    AudioError,
    DatabaseError,
    PermissionError,
    ValidationError
};
