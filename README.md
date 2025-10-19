# @hy_ong/monitor

A complete TypeScript implementation of Ruby's Monitor class for synchronization in async/await code.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔒 **Mutual Exclusion** - Ensures only one async context executes critical sections at a time
- 🔄 **Condition Variables** - Wait/signal patterns for complex synchronization scenarios
- 🎯 **Ruby Compatible** - Complete implementation of Ruby's Monitor API
- 📦 **Zero Dependencies** - Pure TypeScript with no external dependencies
- ✅ **Fully Tested** - 37 comprehensive tests with 100% coverage
- 📝 **Well Documented** - Complete JSDoc comments for all public APIs

## Installation

```bash
bun add @hy_ong/monitor
```

Or with npm:

```bash
npm install @hy_ong/monitor
```

## Quick Start

### Basic Synchronization

```typescript
import {Monitor} from '@hy_ong/monitor';

const monitor = new Monitor();
let counter = 0;

// Multiple concurrent operations
await Promise.all([
  monitor.synchronize(async () => {
    counter++;
  }),
  monitor.synchronize(async () => {
    counter++;
  }),
  monitor.synchronize(async () => {
    counter++;
  })
]);

console.log(counter); // Always 3, never loses updates
```

### Manual Lock Control

```typescript
const monitor = new Monitor();

const owner = await monitor.enter();
try {
  // Critical section
  console.log('Exclusive access');
} finally {
  monitor.exit(owner);
}
```

### Condition Variables

```typescript
const monitor = new Monitor();
const cond = monitor.newCond();
let ready = false;

// Waiter
await monitor.synchronize(async () => {
  while (!ready) {
    await cond.wait();
  }
  console.log('Ready!');
});

// Signaler
await monitor.synchronize(async () => {
  ready = true;
  cond.signal();
});
```

### Producer-Consumer Pattern

```typescript
const monitor = new Monitor();
const notEmpty = monitor.newCond();
const notFull = monitor.newCond();
const queue: number[] = [];
const MAX_SIZE = 5;

// Producer
async function produce(item: number) {
  await monitor.synchronize(async () => {
    while (queue.length >= MAX_SIZE) {
      await notFull.wait();
    }
    queue.push(item);
    notEmpty.signal();
  });
}

// Consumer
async function consume() {
  return await monitor.synchronize(async () => {
    while (queue.length === 0) {
      await notEmpty.wait();
    }
    const item = queue.shift()!;
    notFull.signal();
    return item;
  });
}
```

## API Reference

### Monitor Class

#### `new Monitor()`

Creates a new Monitor instance for synchronization.

#### `synchronize<T>(block: () => T | Promise<T>): Promise<T>`

Executes a function with exclusive access to the monitor. Automatically handles lock acquisition and release.

**Parameters:**

- `block` - The function to execute with exclusive access

**Returns:** The return value of the block function

**Example:**

```typescript
await monitor.synchronize(async () => {
  // Critical section
});
```

#### `async enter(): Promise<LockOwner>`

Acquires the monitor lock. Must be paired with `exit()`.

**Returns:** A LockOwner object to be passed to `exit()`

#### `exit(owner: LockOwner): void`

Releases the monitor lock.

**Parameters:**

- `owner` - The LockOwner object from `enter()`

#### `tryEnter(): LockOwner | null`

Attempts to acquire the lock without blocking.

**Returns:** LockOwner if successful, null if lock is held

#### `newCond(): ConditionVariable`

Creates a new condition variable associated with this monitor.

**Returns:** A new ConditionVariable instance

#### `monLocked(): boolean`

Checks if the monitor is currently locked.

**Returns:** true if locked, false otherwise

#### `monOwned(owner?: LockOwner): boolean`

Checks if the current context owns the lock.

**Parameters:**

- `owner` - The LockOwner object to check

**Returns:** true if the current context owns the lock

### Ruby Method Aliases

For compatibility with Ruby's Monitor API:

- `monEnter()` - Alias for `enter()`
- `monExit(owner)` - Alias for `exit()`
- `monTryEnter()` - Alias for `tryEnter()`
- `tryMonEnter()` - Alias for `tryEnter()`
- `monSynchronize(block)` - Alias for `synchronize()`

### ConditionVariable Class

#### `async wait(timeout?: number): Promise<boolean>`

Releases the lock and waits for a signal. Reacquires the lock before returning.

**Parameters:**

- `timeout` - Optional timeout in milliseconds

**Returns:** true if signaled, false if timed out

#### `async waitWhile(condition: () => boolean, timeout?: number): Promise<boolean>`

Waits while the condition is true.

**Parameters:**

- `condition` - Function that returns true while waiting should continue
- `timeout` - Optional timeout in milliseconds

**Returns:** true if condition became false, false if timed out

#### `async waitUntil(condition: () => boolean, timeout?: number): Promise<boolean>`

Waits until the condition becomes true.

**Parameters:**

- `condition` - Function that returns true when waiting should stop
- `timeout` - Optional timeout in milliseconds

**Returns:** true if condition became true, false if timed out

#### `signal(): void`

Wakes up the first waiting context.

#### `broadcast(): void`

Wakes up all waiting contexts.

### MonitorMixin Class

#### `static extendObject<T>(obj: T): T & MonitorMixin`

Extends an existing object with monitor functionality.

**Parameters:**

- `obj` - The object to extend

**Returns:** The same object with monitor methods added

**Example:**

```typescript
const myObject = {value: 0};
const monitored = MonitorMixin.extendObject(myObject);

await monitored.synchronize(async () => {
  monitored.value++;
});
```

## Advanced Usage

### Extending Classes with MonitorMixin

```typescript
import {MonitorMixin} from '@hy_ong/monitor';

class Counter extends MonitorMixin {
  private value = 0;

  async increment(): Promise<number> {
    return await this.synchronize(async () => {
      this.value++;
      return this.value;
    });
  }

  async getValue(): Promise<number> {
    return await this.synchronize(() => this.value);
  }
}

const counter = new Counter();
await Promise.all([
  counter.increment(),
  counter.increment(),
  counter.increment()
]);

console.log(await counter.getValue()); // 3
```

### Timeout Patterns

```typescript
const monitor = new Monitor();
const cond = monitor.newCond();

// Wait with timeout
await monitor.synchronize(async () => {
  const signaled = await cond.wait(5000); // 5 second timeout
  if (!signaled) {
    console.log('Timeout!');
  }
});

// Wait until with timeout
await monitor.synchronize(async () => {
  const success = await cond.waitUntil(() => ready, 5000);
  if (!success) {
    console.log('Condition not met within timeout');
  }
});
```

## Differences from Ruby Monitor

Due to fundamental differences between Ruby's threading model and JavaScript's async/await:

1. **Owner Parameter**: TypeScript version requires explicitly passing the `LockOwner` object to `exit()`, as JavaScript lacks thread-local storage.

2. **Async/Await**: All blocking operations use `async/await` instead of blocking threads.

3. **Naming**: Uses camelCase (`monEnter`) instead of snake_case (`mon_enter`) following TypeScript conventions.

However, all Ruby Monitor functionality is preserved, and the API semantics remain identical.

## Testing

```bash
bun test
```

All 37 tests pass, covering:

- Basic synchronization
- Manual lock control
- Non-blocking lock attempts
- Condition variables (wait, signal, broadcast)
- Timeout handling
- Producer-consumer patterns
- Class extension with MonitorMixin
- Stress tests with concurrent operations

## Building

```bash
bun run build
```

## License

MIT License - see [LICENSE](LICENSE) file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Author

Ong Hoe Yuan

## Acknowledgments

This is a complete TypeScript implementation of Ruby's Monitor class, maintaining full API compatibility while adapting to JavaScript's async/await model.
