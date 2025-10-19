/**
 * Monitor - Thread synchronization using mutual exclusion
 *
 * A TypeScript implementation of Ruby's Monitor class.
 *
 * In concurrent programming, a monitor is an object or module intended to be used safely
 * by more than one thread. The defining characteristic of a monitor is that its methods
 * are executed with mutual exclusion. That is, at each point in time, at most one thread
 * may be executing any of its methods.
 *
 * @example
 * ```typescript
 * const monitor = new Monitor();
 *
 * // Using synchronize
 * await monitor.synchronize(async () => {
 *   // Critical section - only one async function can execute this at a time
 *   console.log('Exclusive access');
 * });
 *
 * // Using enter/exit
 * const exit = await monitor.enter();
 * try {
 *   // Critical section
 * } finally {
 *   exit();
 * }
 * ```
 */
/**
 * Error thrown when monitor operations are used incorrectly
 */
export declare class MonitorError extends Error {
    constructor(message: string);
}
/**
 * Error thrown when trying to unlock a monitor from a different async context
 */
export declare class ThreadError extends Error {
    constructor(message: string);
}
interface LockOwner {
    id: symbol;
    count: number;
}
/**
 * ConditionVariable - Condition variable for use with Monitor
 *
 * ConditionVariable objects augment class Monitor. Using condition variables,
 * it is possible to suspend while in the middle of a critical section until a
 * resource becomes available.
 *
 * @example
 * ```typescript
 * const monitor = new Monitor();
 * const cond = monitor.newCond();
 *
 * // Thread 1: Wait for condition
 * await monitor.synchronize(async () => {
 *   while (!resourceAvailable) {
 *     await cond.wait();
 *   }
 *   // Use resource
 * });
 *
 * // Thread 2: Signal condition
 * await monitor.synchronize(async () => {
 *   resourceAvailable = true;
 *   cond.signal();
 * });
 * ```
 */
export declare class ConditionVariable {
    private waitQueue;
    private monitor;
    /**
     * Creates a new ConditionVariable associated with the given monitor.
     *
     * @param monitor - The MonitorMixin instance this condition variable is associated with
     * @internal - Typically created via monitor.newCond() rather than directly
     */
    constructor(monitor: MonitorMixin);
    /**
     * Releases the lock held in the associated monitor and waits; reacquires the lock on wakeup.
     *
     * This method must be called while the monitor is owned by the current async context
     * (i.e., within a synchronize block or after calling enter()).
     *
     * When called, this method:
     * 1. Releases the monitor lock
     * 2. Waits for another async context to call signal() or broadcast() on this condition variable
     * 3. Reacquires the monitor lock before returning
     *
     * If timeout is given, this method returns after the timeout period has passed,
     * even if no other context signals the condition variable.
     *
     * @param timeout - Optional timeout in milliseconds. If not provided, waits indefinitely.
     * @returns A promise that resolves to `true` if signaled by signal() or broadcast(),
     *          or `false` if the timeout expired
     * @throws {ThreadError} If called without owning the monitor lock
     *
     * @example
     * ```typescript
     * const monitor = new Monitor();
     * const cond = monitor.newCond();
     * let ready = false;
     *
     * await monitor.synchronize(async () => {
     *   while (!ready) {
     *     await cond.wait(); // Wait for signal
     *   }
     * });
     * ```
     */
    wait(timeout?: number): Promise<boolean>;
    /**
     * Releases the lock and waits while the condition is true; reacquires the lock on wakeup.
     *
     * This is a convenience method that repeatedly calls wait() while the given condition
     * function returns true. It continues waiting until either:
     * - The condition becomes false (returns true)
     * - The timeout expires (returns false)
     *
     * This is equivalent to:
     * ```typescript
     * while (condition()) {
     *   await cond.wait();
     * }
     * ```
     *
     * The condition function is re-evaluated after each wakeup from wait().
     * Must be called while owning the monitor lock.
     *
     * @param condition - A function that returns true while waiting should continue.
     *                    Called while holding the monitor lock.
     * @param timeout - Optional timeout in milliseconds. If not provided, waits indefinitely.
     * @returns A promise that resolves to `true` if the condition became false,
     *          or `false` if the timeout expired while the condition was still true
     *
     * @example
     * ```typescript
     * const monitor = new Monitor();
     * const cond = monitor.newCond();
     * const queue: number[] = [];
     *
     * await monitor.synchronize(async () => {
     *   // Wait while queue is empty
     *   await cond.waitWhile(() => queue.length === 0);
     *   const item = queue.shift(); // Queue is now non-empty
     * });
     * ```
     */
    waitWhile(condition: () => boolean, timeout?: number): Promise<boolean>;
    /**
     * Releases the lock and waits until the condition is true; reacquires the lock on wakeup.
     *
     * This is a convenience method that repeatedly calls wait() until the given condition
     * function returns true. It continues waiting until either:
     * - The condition becomes true (returns true)
     * - The timeout expires (returns false)
     *
     * This is equivalent to:
     * ```typescript
     * while (!condition()) {
     *   await cond.wait();
     * }
     * ```
     *
     * The condition function is re-evaluated after each wakeup from wait().
     * Must be called while owning the monitor lock.
     *
     * @param condition - A function that returns true when waiting should stop.
     *                    Called while holding the monitor lock.
     * @param timeout - Optional timeout in milliseconds. If not provided, waits indefinitely.
     * @returns A promise that resolves to `true` if the condition became true,
     *          or `false` if the timeout expired while the condition was still false
     *
     * @example
     * ```typescript
     * const monitor = new Monitor();
     * const cond = monitor.newCond();
     * let ready = false;
     *
     * await monitor.synchronize(async () => {
     *   // Wait until ready becomes true
     *   await cond.waitUntil(() => ready);
     *   // Now ready is true
     * });
     * ```
     */
    waitUntil(condition: () => boolean, timeout?: number): Promise<boolean>;
    /**
     * Wakes up the first async context in line waiting for this condition.
     *
     * This method wakes up exactly one waiter from the wait queue (if any waiters exist).
     * The woken context will attempt to reacquire the monitor lock and continue execution.
     *
     * If no contexts are waiting, this method has no effect (the signal is not queued).
     *
     * Must be called while owning the monitor lock.
     *
     * @example
     * ```typescript
     * const monitor = new Monitor();
     * const cond = monitor.newCond();
     * let ready = false;
     *
     * // Signaler
     * await monitor.synchronize(async () => {
     *   ready = true;
     *   cond.signal(); // Wake up one waiter
     * });
     * ```
     */
    signal(): void;
    /**
     * Wakes up all async contexts waiting for this condition.
     *
     * This method wakes up all waiters from the wait queue. Each woken context will
     * attempt to reacquire the monitor lock and continue execution.
     *
     * If no contexts are waiting, this method has no effect.
     *
     * Must be called while owning the monitor lock.
     *
     * @example
     * ```typescript
     * const monitor = new Monitor();
     * const cond = monitor.newCond();
     * let ready = false;
     *
     * // Broadcaster
     * await monitor.synchronize(async () => {
     *   ready = true;
     *   cond.broadcast(); // Wake up ALL waiters
     * });
     * ```
     */
    broadcast(): void;
}
/**
 * MonitorMixin - A mixin module that provides monitor functionality
 *
 * This module can be used to add monitor functionality to any class.
 */
export declare class MonitorMixin {
    private locked;
    private lockQueue;
    private condQueue;
    private owner;
    /**
     * Extends an object with monitor functionality.
     *
     * This static method adds all MonitorMixin methods to any existing object,
     * allowing it to be used for synchronization without inheritance.
     * This is similar to Ruby's MonitorMixin.extend_object.
     *
     * All monitor methods are added as non-enumerable properties, so they won't
     * appear in for...in loops or Object.keys().
     *
     * @param obj - The object to extend with monitor functionality
     * @returns The same object, now with all MonitorMixin methods available
     *
     * @example
     * ```typescript
     * const myObject = { value: 0 };
     * const monitored = MonitorMixin.extendObject(myObject);
     *
     * // Now myObject has monitor methods
     * await monitored.synchronize(async () => {
     *   monitored.value++;
     * });
     *
     * // Original properties are preserved
     * console.log(monitored.value); // 1
     *
     * // Monitor methods are non-enumerable
     * console.log(Object.keys(monitored)); // ['value']
     * ```
     */
    static extendObject<T extends object>(obj: T): T & MonitorMixin;
    /**
     * Enters the exclusive section by acquiring the monitor lock.
     *
     * This method blocks (awaits) until the lock becomes available. Once acquired,
     * the current async context holds exclusive access to the monitor until exit() is called.
     *
     * The returned LockOwner object must be passed to exit() to release the lock.
     * Always use a try-finally block to ensure the lock is released:
     *
     * ```typescript
     * const owner = await monitor.enter();
     * try {
     *   // Critical section
     * } finally {
     *   monitor.exit(owner);
     * }
     * ```
     *
     * @returns A promise that resolves to a LockOwner object representing lock ownership.
     *          This object must be passed to exit() to release the lock.
     *
     * @example
     * ```typescript
     * const monitor = new Monitor();
     * const owner = await monitor.enter();
     * try {
     *   console.log('Exclusive access');
     * } finally {
     *   monitor.exit(owner);
     * }
     * ```
     *
     * @see {@link exit} - To release the lock
     * @see {@link tryEnter} - Non-blocking alternative
     * @see {@link synchronize} - Convenience wrapper that handles enter/exit automatically
     */
    enter(): Promise<LockOwner>;
    /**
     * Leaves the exclusive section by releasing the monitor lock.
     *
     * This method releases the lock previously acquired by enter(), tryEnter(), or their aliases.
     * The lock can only be released by the same async context that acquired it,
     * verified by the LockOwner object.
     *
     * After calling exit(), other waiting contexts can acquire the lock.
     *
     * @param owner - The LockOwner object returned from enter(), tryEnter(), or their aliases.
     *                This ensures only the lock owner can release the lock.
     * @throws {ThreadError} If the current context does not own the lock
     *                       (i.e., owner doesn't match the current lock owner)
     *
     * @example
     * ```typescript
     * const monitor = new Monitor();
     * const owner = await monitor.enter();
     * try {
     *   console.log('Critical section');
     * } finally {
     *   monitor.exit(owner); // Always in finally block
     * }
     * ```
     *
     * @see {@link enter} - To acquire the lock
     */
    exit(owner: LockOwner): void;
    /**
     * Attempts to enter the exclusive section without blocking.
     *
     * This is a non-blocking version of enter(). If the lock is currently available,
     * it is acquired immediately and a LockOwner is returned. If the lock is held by
     * another context, this method returns null immediately without waiting.
     *
     * If successful, the returned LockOwner must be passed to exit() to release the lock.
     *
     * @returns The LockOwner object if the lock was successfully acquired,
     *          or null if the lock is currently held by another context
     *
     * @example
     * ```typescript
     * const monitor = new Monitor();
     * const owner = monitor.tryEnter();
     * if (owner !== null) {
     *   try {
     *     console.log('Got the lock!');
     *   } finally {
     *     monitor.exit(owner);
     *   }
     * } else {
     *   console.log('Lock is busy, doing something else');
     * }
     * ```
     *
     * @see {@link enter} - Blocking alternative that waits for the lock
     */
    tryEnter(): LockOwner | null;
    /**
     * Executes a function with exclusive access to the monitor.
     *
     * This is a convenience method that:
     * 1. Acquires the lock (via enter())
     * 2. Executes the provided function
     * 3. Releases the lock (via exit()) even if the function throws an error
     *
     * This is the recommended way to use the monitor, as it ensures the lock is always
     * released, even if an exception occurs.
     *
     * The function receives the LockOwner and monitor instance as parameters,
     * which can be used for advanced scenarios like condition variables.
     *
     * @template T - The return type of the block function
     * @param block - The function to execute with exclusive access.
     *                Receives (owner, monitor) as parameters.
     * @returns A promise that resolves to the return value of the block function
     * @throws Will throw any error that the block function throws (after releasing the lock)
     *
     * @example
     * ```typescript
     * const monitor = new Monitor();
     * let counter = 0;
     *
     * await monitor.synchronize(async () => {
     *   counter++;
     *   console.log('Counter:', counter);
     * });
     * ```
     *
     * @example With condition variable
     * ```typescript
     * const monitor = new Monitor();
     * const cond = monitor.newCond();
     *
     * await monitor.synchronize(async (owner, mon) => {
     *   while (!ready) {
     *     await cond.wait();
     *   }
     * });
     * ```
     *
     * @see {@link enter} - Manual lock acquisition
     * @see {@link exit} - Manual lock release
     */
    synchronize<T>(block: (owner: LockOwner, monitor: this) => T | Promise<T>): Promise<T>;
    /**
     * Creates a new condition variable associated with this monitor.
     *
     * Condition variables allow async contexts to wait for specific conditions
     * while temporarily releasing the monitor lock. Other contexts can then signal
     * when the condition might have changed.
     *
     * Each condition variable is bound to this specific monitor instance and can only
     * be used with it.
     *
     * @returns A new ConditionVariable instance bound to this monitor
     *
     * @example Producer-Consumer Pattern
     * ```typescript
     * const monitor = new Monitor();
     * const notEmpty = monitor.newCond();
     * const notFull = monitor.newCond();
     * const queue: number[] = [];
     * const MAX_SIZE = 5;
     *
     * // Producer
     * await monitor.synchronize(async () => {
     *   while (queue.length >= MAX_SIZE) {
     *     await notFull.wait();
     *   }
     *   queue.push(item);
     *   notEmpty.signal();
     * });
     *
     * // Consumer
     * await monitor.synchronize(async () => {
     *   while (queue.length === 0) {
     *     await notEmpty.wait();
     *   }
     *   const item = queue.shift();
     *   notFull.signal();
     * });
     * ```
     *
     * @see {@link ConditionVariable} - For condition variable methods (wait, signal, broadcast)
     */
    newCond(): ConditionVariable;
    /**
     * Returns true if the monitor is currently locked by any async context.
     *
     * This method checks whether the monitor lock is held, regardless of which
     * context owns it. Use monOwned() to check if the current context owns the lock.
     *
     * For compatibility with Ruby's Monitor#mon_locked?
     *
     * @returns true if the monitor is locked by any context, false if unlocked
     *
     * @example
     * ```typescript
     * const monitor = new Monitor();
     * console.log(monitor.monLocked()); // false
     *
     * const owner = await monitor.enter();
     * console.log(monitor.monLocked()); // true
     * monitor.exit(owner);
     * console.log(monitor.monLocked()); // false
     * ```
     *
     * @see {@link monOwned} - To check if the current context owns the lock
     */
    monLocked(): boolean;
    /**
     * Returns true if this monitor is locked by the current async context.
     *
     * This method checks whether the provided owner matches the current lock owner.
     * Unlike monLocked(), this specifically checks ownership by the calling context.
     *
     * For compatibility with Ruby's Monitor#mon_owned?
     *
     * @param owner - The LockOwner object from enter/monEnter. If not provided, returns false.
     * @returns true if the current context owns the monitor (i.e., owner matches), false otherwise
     *
     * @example
     * ```typescript
     * const monitor = new Monitor();
     * const owner = await monitor.enter();
     *
     * console.log(monitor.monOwned(owner)); // true
     * console.log(monitor.monOwned());      // false (no owner provided)
     *
     * monitor.exit(owner);
     * console.log(monitor.monOwned(owner)); // false (lock released)
     * ```
     *
     * @see {@link monLocked} - To check if the monitor is locked at all
     */
    monOwned(owner?: LockOwner): boolean;
    /**
     * Enters the exclusive section by acquiring the monitor lock.
     *
     * Alias for enter(). For compatibility with Ruby's Monitor#mon_enter.
     *
     * @returns A promise that resolves to a LockOwner object
     * @throws {ThreadError} If the lock cannot be acquired
     *
     * @see {@link enter} - Full documentation
     */
    monEnter(): Promise<LockOwner>;
    /**
     * Leaves the exclusive section by releasing the monitor lock.
     *
     * Alias for exit(). For compatibility with Ruby's Monitor#mon_exit.
     *
     * @param owner - The LockOwner object returned from enter()
     * @throws {ThreadError} If not called by the lock owner
     *
     * @see {@link exit} - Full documentation
     */
    monExit(owner: LockOwner): void;
    /**
     * Attempts to enter the exclusive section without blocking.
     *
     * Alias for tryEnter(). For compatibility with Ruby's Monitor#mon_try_enter.
     *
     * @returns The LockOwner object if acquired, or null if lock is held by another context
     *
     * @see {@link tryEnter} - Full documentation
     */
    monTryEnter(): LockOwner | null;
    /**
     * Attempts to enter the exclusive section without blocking.
     *
     * Alias for tryEnter(). For compatibility with Ruby's Monitor#try_mon_enter.
     *
     * @returns The LockOwner object if acquired, or null if lock is held by another context
     *
     * @see {@link tryEnter} - Full documentation
     */
    tryMonEnter(): LockOwner | null;
    /**
     * Executes a function with exclusive access to the monitor.
     *
     * Alias for synchronize(). For compatibility with Ruby's Monitor#mon_synchronize.
     *
     * @template T - The return type of the block function
     * @param block - The function to execute with exclusive access
     * @returns A promise that resolves to the return value of the block
     * @throws Will throw any error that the block function throws
     *
     * @see {@link synchronize} - Full documentation
     */
    monSynchronize<T>(block: (owner: LockOwner, monitor: this) => T | Promise<T>): Promise<T>;
    /**
     * Temporarily releases the lock for condition variable wait operations.
     *
     * This internal method is called by ConditionVariable.wait() to release the lock
     * while waiting for a signal. It saves the current lock state (including reentrant
     * count) and wakes up the next waiter.
     *
     * @internal
     * @returns The saved lock owner state, to be restored later
     * @throws {ThreadError} If called without owning the lock
     */
    _exitForCond(): LockOwner;
    /**
     * Reacquires the lock after waiting on a condition variable.
     *
     * This internal method is called by ConditionVariable.wait() to reacquire the lock
     * after being signaled. It uses a priority queue to ensure condition variable waiters
     * are woken before normal lock waiters, maintaining correct semantics.
     *
     * @internal
     * @param state - The saved lock owner state from _exitForCond()
     * @returns A promise that resolves when the lock has been reacquired
     */
    _enterForCond(state: LockOwner): Promise<void>;
    /**
     * Wakes up the next waiter in the queue.
     *
     * This internal method implements a priority system where condition variable
     * reacquisitions are processed before normal lock acquisitions. This ensures
     * that contexts waiting after a condition variable signal can reacquire the lock
     * before new contexts trying to acquire it.
     *
     * Priority order:
     * 1. Condition variable reacquisitions (condQueue)
     * 2. Normal lock acquisitions (lockQueue)
     *
     * @private
     */
    private _wakeupNext;
}
/**
 * Monitor - A synchronization primitive for mutual exclusion in async/await code.
 *
 * The Monitor class provides thread-safe synchronization for concurrent async operations.
 * It ensures that only one async context can execute within a critical section at a time,
 * preventing race conditions and ensuring data consistency.
 *
 * This is a complete TypeScript implementation of Ruby's Monitor class, including:
 * - Mutual exclusion locks (enter/exit/tryEnter)
 * - Automatic lock management (synchronize)
 * - Condition variables for wait/signal patterns
 * - All Ruby Monitor method aliases (mon_enter, mon_exit, etc.)
 *
 * Use this class when you need to protect shared resources from concurrent access
 * in async/await code.
 *
 * @example Basic synchronization
 * ```typescript
 * const monitor = new Monitor();
 * let counter = 0;
 *
 * // Multiple concurrent operations
 * await Promise.all([
 *   monitor.synchronize(async () => { counter++; }),
 *   monitor.synchronize(async () => { counter++; }),
 *   monitor.synchronize(async () => { counter++; })
 * ]);
 *
 * console.log(counter); // Always 3, never loses updates
 * ```
 *
 * @example Producer-Consumer with condition variables
 * ```typescript
 * const monitor = new Monitor();
 * const notEmpty = monitor.newCond();
 * const queue: number[] = [];
 *
 * // Consumer
 * async function consume() {
 *   await monitor.synchronize(async () => {
 *     while (queue.length === 0) {
 *       await notEmpty.wait(); // Wait for items
 *     }
 *     return queue.shift();
 *   });
 * }
 *
 * // Producer
 * async function produce(item: number) {
 *   await monitor.synchronize(async () => {
 *     queue.push(item);
 *     notEmpty.signal(); // Wake up consumer
 *   });
 * }
 * ```
 *
 * @see {@link MonitorMixin} - For extending existing classes with monitor functionality
 * @see {@link ConditionVariable} - For wait/signal synchronization patterns
 */
export declare class Monitor extends MonitorMixin {
    /**
     * Creates a new Monitor instance for synchronization.
     *
     * The monitor starts in an unlocked state and is ready to be used immediately.
     *
     * @example
     * ```typescript
     * const monitor = new Monitor();
     * await monitor.synchronize(async () => {
     *   console.log('Critical section');
     * });
     * ```
     */
    constructor();
    /**
     * Executes a function with exclusive access to the monitor.
     *
     * This method provides two overloads for convenience:
     * 1. Simple form: Block function takes no parameters (most common use case)
     * 2. Advanced form: Block function receives (owner, monitor) for condition variables
     *
     * The method automatically:
     * - Acquires the lock before executing the block
     * - Executes the block function
     * - Releases the lock even if the block throws an error
     *
     * This is the recommended way to use Monitor for most scenarios.
     *
     * @template T - The return type of the block function
     * @param block - The function to execute with exclusive access.
     *                Can optionally receive (owner, monitor) as parameters.
     * @returns A promise that resolves to the return value of the block function
     * @throws Will throw any error that the block function throws (after releasing the lock)
     *
     * @example Simple usage (no parameters)
     * ```typescript
     * const monitor = new Monitor();
     * let counter = 0;
     *
     * await monitor.synchronize(async () => {
     *   counter++;  // Safely increment
     * });
     * ```
     *
     * @example Advanced usage (with condition variables)
     * ```typescript
     * const monitor = new Monitor();
     * const cond = monitor.newCond();
     * let ready = false;
     *
     * await monitor.synchronize(async (owner, mon) => {
     *   while (!ready) {
     *     await cond.wait();  // Uses monitor internally
     *   }
     * });
     * ```
     *
     * @override Extends MonitorMixin.synchronize with method overloading for convenience
     */
    synchronize<T>(block: () => T | Promise<T>): Promise<T>;
    synchronize<T>(block: (owner: LockOwner, monitor: this) => T | Promise<T>): Promise<T>;
}
/**
 * Default export
 */
export default Monitor;
