import { beforeEach, describe, expect, it } from "bun:test"
import { Monitor, MonitorMixin } from "@hy-ong/monitor"

describe("Monitor", () => {
  let monitor: Monitor

  beforeEach(() => {
    monitor = new Monitor()
  })

  describe("synchronize", () => {
    it("should execute block with mutual exclusion", async () => {
      const results: number[] = []

      await Promise.all([
        monitor.synchronize(async () => {
          results.push(1)
          await new Promise((resolve) => setTimeout(resolve, 10))
          results.push(2)
        }),
        monitor.synchronize(async () => {
          results.push(3)
          await new Promise((resolve) => setTimeout(resolve, 10))
          results.push(4)
        }),
      ])

      // Should be sequential: [1,2,3,4] or [3,4,1,2]
      expect((results[0] === 1 && results[1] === 2 && results[2] === 3 && results[3] === 4) || (results[0] === 3 && results[1] === 4 && results[2] === 1 && results[3] === 2)).toBe(true)
    })

    it("should return the value from the block", async () => {
      const result = await monitor.synchronize(() => 42)
      expect(result).toBe(42)
    })

    it("should propagate errors from the block", async () => {
      await expect(
        monitor.synchronize(() => {
          throw new Error("test error")
        })
      ).rejects.toThrow("test error")
    })
  })

  describe("enter and exit", () => {
    it("should allow manual lock acquisition and release", async () => {
      const owner = await monitor.enter()
      expect(monitor.monLocked()).toBe(true)
      monitor.exit(owner)
      expect(monitor.monLocked()).toBe(false)
    })

    it("should enforce mutual exclusion with manual locking", async () => {
      const results: number[] = []

      await Promise.all([
        (async () => {
          const owner = await monitor.enter()
          try {
            results.push(1)
            await new Promise((resolve) => setTimeout(resolve, 10))
            results.push(2)
          } finally {
            monitor.exit(owner)
          }
        })(),
        (async () => {
          const owner = await monitor.enter()
          try {
            results.push(3)
            await new Promise((resolve) => setTimeout(resolve, 10))
            results.push(4)
          } finally {
            monitor.exit(owner)
          }
        })(),
      ])

      expect((results[0] === 1 && results[1] === 2 && results[2] === 3 && results[3] === 4) || (results[0] === 3 && results[1] === 4 && results[2] === 1 && results[3] === 2)).toBe(true)
    })
  })

  describe("tryEnter", () => {
    it("should acquire lock if available", () => {
      const owner = monitor.tryEnter()
      expect(owner).not.toBe(null)
      expect(monitor.monLocked()).toBe(true)
      monitor.exit(owner!)
      expect(monitor.monLocked()).toBe(false)
    })

    it("should return null if lock is held", async () => {
      const owner1 = await monitor.enter()
      const owner2 = monitor.tryEnter()
      expect(owner2).toBe(null)
      monitor.exit(owner1)
    })
  })

  describe("monLocked", () => {
    it("should return false when unlocked", () => {
      expect(monitor.monLocked()).toBe(false)
    })

    it("should return true when locked", async () => {
      const owner = await monitor.enter()
      expect(monitor.monLocked()).toBe(true)
      monitor.exit(owner)
    })
  })

  describe("monOwned", () => {
    it("should return false when unlocked", () => {
      expect(monitor.monOwned()).toBe(false)
    })

    it("should return true when locked by current context", async () => {
      const owner = await monitor.enter()
      expect(monitor.monOwned(owner)).toBe(true)
      monitor.exit(owner)
    })

    it("should return false when owner is not provided", async () => {
      const owner = await monitor.enter()
      expect(monitor.monOwned()).toBe(false)
      monitor.exit(owner)
    })
  })

  describe("Ruby method aliases", () => {
    describe("monEnter/monExit", () => {
      it("monEnter should work like enter", async () => {
        const owner = await monitor.monEnter()
        expect(monitor.monLocked()).toBe(true)
        monitor.monExit(owner)
        expect(monitor.monLocked()).toBe(false)
      })

      it("monExit should work like exit", async () => {
        const owner = await monitor.enter()
        expect(monitor.monLocked()).toBe(true)
        monitor.monExit(owner)
        expect(monitor.monLocked()).toBe(false)
      })
    })

    describe("monTryEnter/tryMonEnter", () => {
      it("monTryEnter should work like tryEnter", () => {
        const owner = monitor.monTryEnter()
        expect(owner).not.toBe(null)
        expect(monitor.monLocked()).toBe(true)
        monitor.exit(owner!)
        expect(monitor.monLocked()).toBe(false)
      })

      it("tryMonEnter should work like tryEnter", () => {
        const owner = monitor.tryMonEnter()
        expect(owner).not.toBe(null)
        expect(monitor.monLocked()).toBe(true)
        monitor.exit(owner!)
        expect(monitor.monLocked()).toBe(false)
      })

      it("monTryEnter should return null if lock is held", async () => {
        const owner1 = await monitor.monEnter()
        const owner2 = monitor.monTryEnter()
        expect(owner2).toBe(null)
        monitor.exit(owner1)
      })

      it("tryMonEnter should return null if lock is held", async () => {
        const owner1 = await monitor.enter()
        const owner2 = monitor.tryMonEnter()
        expect(owner2).toBe(null)
        monitor.exit(owner1)
      })
    })

    describe("monSynchronize", () => {
      it("should execute block with mutual exclusion", async () => {
        const results: number[] = []

        await Promise.all([
          monitor.monSynchronize(async () => {
            results.push(1)
            await new Promise((resolve) => setTimeout(resolve, 10))
            results.push(2)
          }),
          monitor.monSynchronize(async () => {
            results.push(3)
            await new Promise((resolve) => setTimeout(resolve, 10))
            results.push(4)
          }),
        ])

        expect((results[0] === 1 && results[1] === 2 && results[2] === 3 && results[3] === 4) || (results[0] === 3 && results[1] === 4 && results[2] === 1 && results[3] === 2)).toBe(true)
      })

      it("should return the value from the block", async () => {
        const result = await monitor.monSynchronize(() => 42)
        expect(result).toBe(42)
      })
    })
  })
})

describe("ConditionVariable", () => {
  let monitor: Monitor
  let cond: ReturnType<Monitor["newCond"]>

  beforeEach(() => {
    monitor = new Monitor()
    cond = monitor.newCond()
  })

  describe("wait and signal", () => {
    it("should wait for signal", async () => {
      let resourceAvailable = false

      const waiter = monitor.synchronize(async () => {
        while (!resourceAvailable) {
          await cond.wait()
        }
        return "got resource"
      })

      // Give waiter time to start waiting
      await new Promise((resolve) => setTimeout(resolve, 10))

      await monitor.synchronize(async () => {
        resourceAvailable = true
        cond.signal()
      })

      const result = await waiter
      expect(result).toBe("got resource")
    })

    it("should wake up only one waiter with signal", async () => {
      let count = 0
      const results: number[] = []

      const waiters = [
        monitor.synchronize(async () => {
          await cond.wait()
          results.push(++count)
        }),
        monitor.synchronize(async () => {
          await cond.wait()
          results.push(++count)
        }),
      ]

      await new Promise((resolve) => setTimeout(resolve, 10))

      // Signal once - should wake only one
      await monitor.synchronize(async () => {
        cond.signal()
      })

      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(results.length).toBe(1)

      // Signal again - should wake the other
      await monitor.synchronize(async () => {
        cond.signal()
      })

      await Promise.all(waiters)
      expect(results.length).toBe(2)
    })
  })

  describe("broadcast", () => {
    it("should wake up all waiters", async () => {
      let count = 0
      const results: number[] = []

      const waiters = [
        monitor.synchronize(async () => {
          await cond.wait()
          results.push(++count)
        }),
        monitor.synchronize(async () => {
          await cond.wait()
          results.push(++count)
        }),
        monitor.synchronize(async () => {
          await cond.wait()
          results.push(++count)
        }),
      ]

      await new Promise((resolve) => setTimeout(resolve, 10))

      await monitor.synchronize(async () => {
        cond.broadcast()
      })

      await Promise.all(waiters)
      expect(results.length).toBe(3)
    })
  })

  describe("wait with timeout", () => {
    it("should return false on timeout", async () => {
      const result = await monitor.synchronize(async () => {
        return await cond.wait(10)
      })

      expect(result).toBe(false)
    })

    it("should return true when signaled before timeout", async () => {
      const waiter = monitor.synchronize(async () => {
        return await cond.wait(100)
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      await monitor.synchronize(async () => {
        cond.signal()
      })

      const result = await waiter
      expect(result).toBe(true)
    })
  })

  describe("classic producer-consumer example", () => {
    it("should handle producer-consumer pattern", async () => {
      const queue: number[] = []
      const consumed: number[] = []
      const MAX_SIZE = 5

      const notFull = monitor.newCond()
      const notEmpty = monitor.newCond()

      // Producer
      const producer = async () => {
        for (let i = 1; i <= 10; i++) {
          await monitor.synchronize(async () => {
            while (queue.length >= MAX_SIZE) {
              await notFull.wait()
            }
            queue.push(i)
            notEmpty.signal()
          })
        }
      }

      // Consumer
      const consumer = async () => {
        for (let i = 1; i <= 10; i++) {
          await monitor.synchronize(async () => {
            while (queue.length === 0) {
              await notEmpty.wait()
            }
            const item = queue.shift()!
            consumed.push(item)
            notFull.signal()
          })
        }
      }

      await Promise.all([producer(), consumer()])

      expect(consumed).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    })
  })

  describe("waitWhile", () => {
    it("should wait while condition is true", async () => {
      let count = 0

      const waiter = monitor.synchronize(async () => {
        return await cond.waitWhile(() => count < 3)
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      // Increment and signal
      await monitor.synchronize(async () => {
        count++
        cond.signal()
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      await monitor.synchronize(async () => {
        count++
        cond.signal()
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      await monitor.synchronize(async () => {
        count++
        cond.signal()
      })

      const result = await waiter
      expect(result).toBe(true)
      expect(count).toBe(3)
    })

    it("should return false on timeout", async () => {
      const result = await monitor.synchronize(async () => {
        return await cond.waitWhile(() => true, 50)
      })

      expect(result).toBe(false)
    })
  })

  describe("waitUntil", () => {
    it("should wait until condition is true", async () => {
      let ready = false

      const waiter = monitor.synchronize(async () => {
        return await cond.waitUntil(() => ready)
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      await monitor.synchronize(async () => {
        ready = true
        cond.signal()
      })

      const result = await waiter
      expect(result).toBe(true)
      expect(ready).toBe(true)
    })

    it("should return false on timeout", async () => {
      const result = await monitor.synchronize(async () => {
        return await cond.waitUntil(() => false, 50)
      })

      expect(result).toBe(false)
    })
  })
})

describe("MonitorMixin", () => {
  it("can be extended by other classes", async () => {
    class MyResource extends MonitorMixin {
      private value = 0

      async increment(): Promise<number> {
        return await this.synchronize(async () => {
          const current = this.value
          await new Promise((resolve) => setTimeout(resolve, 1))
          this.value = current + 1
          return this.value
        })
      }

      async getValue(): Promise<number> {
        return await this.synchronize(() => this.value)
      }
    }

    const resource = new MyResource()

    await Promise.all([resource.increment(), resource.increment(), resource.increment()])

    const value = await resource.getValue()
    expect(value).toBe(3)
  })

  describe("extendObject", () => {
    it("should add monitor functionality to an object", async () => {
      const obj = { value: 0 }
      const monitored = MonitorMixin.extendObject(obj)

      expect(monitored.value).toBe(0)
      expect(typeof monitored.synchronize).toBe("function")
      expect(typeof monitored.enter).toBe("function")
      expect(typeof monitored.exit).toBe("function")
    })

    it("should provide working synchronization on extended object", async () => {
      const obj = { counter: 0 }
      const monitored = MonitorMixin.extendObject(obj)

      const operations = Array.from({ length: 10 }, async () => {
        await monitored.synchronize(async () => {
          const current = monitored.counter
          await new Promise((resolve) => setTimeout(resolve, 1))
          monitored.counter = current + 1
        })
      })

      await Promise.all(operations)
      expect(monitored.counter).toBe(10)
    })

    it("should support condition variables on extended object", async () => {
      const obj = { ready: false }
      const monitored = MonitorMixin.extendObject(obj)
      const cond = monitored.newCond()

      const waiter = monitored.synchronize(async () => {
        while (!monitored.ready) {
          await cond.wait()
        }
        return "done"
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      await monitored.synchronize(async () => {
        monitored.ready = true
        cond.signal()
      })

      const result = await waiter
      expect(result).toBe("done")
      expect(monitored.ready).toBe(true)
    })

    it("should include Ruby method aliases on extended object", async () => {
      const obj = { value: 0 }
      const monitored = MonitorMixin.extendObject(obj)

      // Test monEnter/monExit
      const owner1 = await monitored.monEnter()
      expect(monitored.monLocked()).toBe(true)
      expect(monitored.monOwned(owner1)).toBe(true)
      monitored.monExit(owner1)
      expect(monitored.monLocked()).toBe(false)

      // Test monTryEnter/tryMonEnter
      const owner2 = monitored.monTryEnter()
      expect(owner2).not.toBe(null)
      expect(monitored.monLocked()).toBe(true)
      monitored.exit(owner2!)
      expect(monitored.monLocked()).toBe(false)

      const owner3 = monitored.tryMonEnter()
      expect(owner3).not.toBe(null)
      expect(monitored.monLocked()).toBe(true)
      monitored.exit(owner3!)
      expect(monitored.monLocked()).toBe(false)

      // Test monSynchronize
      const result = await monitored.monSynchronize(async () => {
        monitored.value = 42
        return monitored.value
      })
      expect(result).toBe(42)
      expect(monitored.value).toBe(42)
    })
  })
})

describe("Stress test", () => {
  it("should handle many concurrent operations", async () => {
    const monitor = new Monitor()
    let counter = 0

    const operations = Array.from({ length: 100 }, async () => {
      await monitor.synchronize(async () => {
        const current = counter
        await new Promise((resolve) => setTimeout(resolve, 1))
        counter = current + 1
      })
    })

    await Promise.all(operations)
    expect(counter).toBe(100)
  })

  it("should handle many waiters on condition variable", async () => {
    const monitor = new Monitor()
    const cond = monitor.newCond()
    let ready = false
    let count = 0

    const waiters = Array.from({ length: 50 }, async () => {
      await monitor.synchronize(async () => {
        while (!ready) {
          await cond.wait()
        }
        count++
      })
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    await monitor.synchronize(async () => {
      ready = true
      cond.broadcast()
    })

    await Promise.all(waiters)
    expect(count).toBe(50)
  })
})
