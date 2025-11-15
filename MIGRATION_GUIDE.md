# Module Reorganization Migration Guide

This guide documents the changes made during the module reorganization project and provides instructions for developers working with the updated codebase.

## Overview

The module reorganization project refactored five modules (Admin, Economy, Leveling, Moderation, Music) to follow a consistent architecture pattern with proper separation of concerns. This involved:

- Creating service classes to encapsulate business logic
- Creating interaction handlers for button, select menu, and modal interactions
- Refactoring command files to use services and interactions
- Establishing consistent patterns across all modules

## What Changed

### Architecture Changes

#### Before

```
src/bot/modules/{module}/
├── commands/
│   └── command.js (contained all logic)
├── interactions/ (empty)
└── services/ (empty)
```

#### After

```
src/bot/modules/{module}/
├── commands/
│   └── command.js (orchestration only)
├── interactions/
│   ├── button-handler.js
│   ├── select-menu-handler.js
│   └── modal-handler.js
└── services/
    ├── BusinessService.js
    └── DataService.js
```

### Module-Specific Changes

#### Admin Module

**Services Added:**

- `PerformanceService` - System and bot metrics collection

**Changes:**

- `performance` command now uses `PerformanceService` for metrics
- Business logic moved from command to service

**Breaking Changes:** None

#### Economy Module

**Services Added:**

- `EconomyService` - Balance and transaction management
- `GameService` - Gambling game mechanics
- `ShopService` - Shop and inventory operations

**Interactions Added:**

- `blackjack-hit.js` - Handle blackjack hit action
- `blackjack-stand.js` - Handle blackjack stand action
- `roulette-select.js` - Handle roulette bet selection
- `slots-spin.js` - Handle slots spin action
- `shop-buy-confirm.js` - Confirm shop purchase
- `shop-buy-cancel.js` - Cancel shop purchase

**Changes:**

- All gambling games now use interactive buttons
- Shop purchases require confirmation
- Balance operations use `EconomyService`
- Game state management moved to `GameService`
- Inventory operations use `ShopService`

**Breaking Changes:** None (backward compatible)

#### Leveling Module

**Services Added:**

- `LevelingService` - XP and level management
- `RewardService` - Reward configuration and application

**Interactions Added:**

- `leaderboard-page.js` - Handle leaderboard pagination
- `reward-select.js` - Handle reward selection (future feature)

**Changes:**

- XP operations use `LevelingService`
- Reward management uses `RewardService`
- Leaderboard uses pagination buttons
- Level-up logic centralized in service

**Breaking Changes:** None

#### Moderation Module

**Services Added:**

- `ModerationService` - Moderation actions (ban, kick, warn, etc.)
- `InfractionService` - Infraction tracking and history
- `AutoModService` - Automated moderation rules

**Interactions Added:**

- `ban-confirm.js` - Confirm ban action
- `ban-cancel.js` - Cancel ban action
- `kick-confirm.js` - Confirm kick action
- `kick-cancel.js` - Cancel kick action
- `warn-reason-modal.js` - Collect warning reason
- `automod-config.js` - Configure automod settings

**Changes:**

- Destructive actions (ban, kick) now require confirmation
- Warn command uses modal for detailed reason
- All moderation actions use `ModerationService`
- Infraction tracking uses `InfractionService`
- AutoMod uses `AutoModService`

**Breaking Changes:** None (confirmation dialogs are additions)

#### Music Module

**Services Added:**

- `MusicPlayerService` - Playback control and queue management
- `PlaylistService` - Playlist CRUD operations

**Interactions Added:**

- `music-play-pause.js` - Toggle play/pause
- `music-skip.js` - Skip track
- `music-stop.js` - Stop playback
- `queue-remove.js` - Remove track from queue
- `queue-move.js` - Move track in queue
- `playlist-select.js` - Select playlist to load

**Changes:**

- Player controls now use interactive buttons
- Queue management uses `MusicPlayerService`
- Playlist operations use `PlaylistService`
- Now playing display includes control buttons

**Breaking Changes:** None

## Migration Steps

### For Developers

If you're working with the updated codebase, follow these guidelines:

#### 1. Using Services in Commands

**Old Pattern (Don't use):**

```javascript
// command.js
async execute(message, args) {
  // Direct database access
  const balance = await this.client.database.get(
    'SELECT * FROM economy WHERE member_id = ?',
    [message.author.id]
  );

  // Business logic in command
  const newBalance = balance.wallet + 100;
  await this.client.database.run(
    'UPDATE economy SET wallet = ? WHERE member_id = ?',
    [newBalance, message.author.id]
  );
}
```

**New Pattern (Use this):**

```javascript
// command.js
async execute(message, args) {
  // Get service from module
  const economyService = this.client.modules
    .get('Economy')
    .getService('EconomyService');

  // Use service method
  await economyService.addBalance(
    message.author.id,
    100,
    'Command reward'
  );
}
```

#### 2. Creating Interaction Handlers

**Pattern:**

```javascript
// interactions/my-button.js
const { BaseButtonInteraction } = require("../../../base/BaseInteraction");

class MyButtonInteraction extends BaseButtonInteraction {
  constructor(client) {
    super(client, {
      name: "my-button",
      description: "Handle my button interaction",
      customId: "my_button", // or pattern: 'my_button_*'
      category: "ModuleName",
    });
  }

  async execute(interaction) {
    try {
      // Defer the interaction
      await this.defer(interaction, true);

      // Get service
      const module = this.client.modules.get("ModuleName");
      const service = module.getService("ServiceName");

      // Execute business logic
      const result = await service.doSomething(interaction);

      // Send response
      await this.edit(interaction, this.formatSuccess("Operation completed"));
    } catch (error) {
      this.client.logger.error("Error in interaction", {
        error: error.message,
      });
      await this.edit(interaction, this.formatError("An error occurred"));
    }
  }
}

module.exports = MyButtonInteraction;
```

#### 3. Creating Service Classes

**Pattern:**

```javascript
// services/MyService.js
class MyService {
  constructor(client, module) {
    this.client = client;
    this.module = module;
    this.db = client.database;
    this.logger = module.logger;
  }

  /**
   * Do something useful
   * @param {string} userId - User ID
   * @param {Object} data - Data object
   * @returns {Promise<Object>} Result
   */
  async doSomething(userId, data) {
    try {
      // Business logic here
      const result = await this.db.get(
        "SELECT * FROM table WHERE user_id = ?",
        [userId]
      );

      // Process and return
      return result;
    } catch (error) {
      this.logger.error("Error in service method", {
        error: error.message,
        method: "doSomething",
        userId,
      });
      throw error;
    }
  }
}

module.exports = MyService;
```

#### 4. Registering Services in Module

**Pattern:**

```javascript
// ModuleName.js
const MyService = require("./services/MyService");

class ModuleNameModule extends BaseModule {
  constructor(client) {
    super(client, {
      name: "ModuleName",
      // ...
    });

    // Register services
    this.registerService("MyService", new MyService(client, this));
  }

  // Get service
  getService(name) {
    return this.services.get(name);
  }
}
```

## Deprecated Patterns

### ❌ Don't Do This

1. **Direct database access in commands:**

   ```javascript
   // BAD
   await this.client.database.run("UPDATE ...");
   ```

2. **Business logic in commands:**

   ```javascript
   // BAD
   const newBalance = oldBalance + amount;
   // ... complex calculations ...
   ```

3. **Interaction handling in commands:**

   ```javascript
   // BAD
   collector.on("collect", async (interaction) => {
     // ... handling logic in command ...
   });
   ```

4. **Mixing concerns:**
   ```javascript
   // BAD - command doing everything
   async execute(message, args) {
     // validation
     // database access
     // business logic
     // interaction handling
     // response formatting
   }
   ```

### ✅ Do This Instead

1. **Use services for database access:**

   ```javascript
   // GOOD
   const service = module.getService("ServiceName");
   await service.updateData(userId, data);
   ```

2. **Encapsulate business logic in services:**

   ```javascript
   // GOOD
   const result = await service.calculateBalance(userId, amount);
   ```

3. **Create separate interaction handlers:**

   ```javascript
   // GOOD - separate file
   class MyButtonInteraction extends BaseButtonInteraction {
     async execute(interaction) {
       /* ... */
     }
   }
   ```

4. **Separate concerns:**
   ```javascript
   // GOOD - command orchestrates
   async execute(message, args) {
     // 1. Validate input
     if (!args[0]) return message.reply('Invalid input');

     // 2. Use service
     const service = module.getService('ServiceName');
     const result = await service.doSomething(args[0]);

     // 3. Format and send response
     return message.reply(this.formatResult(result));
   }
   ```

## Testing After Migration

### Verify Module Functionality

For each module, test the following:

#### Admin Module

- [ ] `!performance` command displays metrics correctly
- [ ] All metrics (system, bot, database, cache) are accurate

#### Economy Module

- [ ] Balance commands work (`!balance`, `!deposit`, `!withdraw`)
- [ ] Gambling games work with button interactions
- [ ] Shop purchases require confirmation
- [ ] Transaction history is logged correctly

#### Leveling Module

- [ ] XP gain works on messages
- [ ] Level-up notifications appear
- [ ] Rewards are applied correctly
- [ ] Leaderboard pagination works

#### Moderation Module

- [ ] Ban/kick commands show confirmation dialogs
- [ ] Warn command opens modal for reason
- [ ] Infractions are tracked correctly
- [ ] AutoMod rules work as configured

#### Music Module

- [ ] Playback controls work with buttons
- [ ] Queue management works correctly
- [ ] Playlist system functions properly
- [ ] Now playing display shows controls

### Integration Testing

- [ ] All modules load without errors
- [ ] Services are registered correctly
- [ ] Interactions are registered correctly
- [ ] No conflicts between modules
- [ ] Database operations work correctly
- [ ] Error handling works as expected

## Troubleshooting

### Common Issues

#### Service Not Found

**Error:** `Cannot read property 'doSomething' of undefined`

**Solution:** Ensure service is registered in module constructor:

```javascript
this.registerService("ServiceName", new ServiceName(client, this));
```

#### Interaction Not Responding

**Error:** Interaction times out or doesn't respond

**Solution:** Ensure interaction is deferred:

```javascript
await this.defer(interaction, true);
```

#### Database Errors

**Error:** Database queries fail

**Solution:** Check that service has access to database:

```javascript
this.db = client.database;
```

#### Module Not Loading

**Error:** Module fails to load

**Solution:** Check that all services and interactions are properly exported:

```javascript
module.exports = ServiceName;
```

## Best Practices

### 1. Service Design

- Keep services focused on single responsibility
- Use descriptive method names
- Add JSDoc comments for all methods
- Handle errors gracefully
- Log important operations

### 2. Interaction Handlers

- Always defer interactions immediately
- Use try-catch for error handling
- Provide user-friendly error messages
- Clean up resources (collectors, timeouts)
- Validate user permissions

### 3. Command Files

- Keep commands thin (orchestration only)
- Delegate to services for business logic
- Use interactions for complex user input
- Validate input before calling services
- Format responses consistently

### 4. Error Handling

- Log errors with context
- Don't expose internal errors to users
- Provide actionable error messages
- Handle edge cases gracefully
- Use appropriate error types

### 5. Documentation

- Document all public methods
- Include usage examples
- Document customId patterns
- Keep README files updated
- Document breaking changes

## Getting Help

If you encounter issues during migration or have questions:

1. Check the module README files for usage examples
2. Review the design document at `.kiro/specs/module-reorganization/design.md`
3. Look at existing implementations in ticket and utility modules
4. Check the troubleshooting section above
5. Review the test files for examples

## Rollback Procedure

If critical issues are discovered, rollback is possible:

1. Revert to previous commit before reorganization
2. Restore database backup if schema changed
3. Clear any cached data
4. Restart bot

**Note:** No database schema changes were made, so rollback is safe.

## Future Improvements

Potential enhancements for future iterations:

1. Add unit tests for all services
2. Add integration tests for interaction flows
3. Implement service dependency injection
4. Add service middleware for common operations
5. Create service base class for shared functionality
6. Add performance monitoring for services
7. Implement service caching layer
8. Add service health checks

## Conclusion

The module reorganization improves code maintainability, reusability, and testability. By following the patterns and guidelines in this document, developers can work effectively with the updated codebase and maintain consistency across modules.

For questions or issues, please refer to the module-specific README files or the design document.
