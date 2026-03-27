import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
  // Clear localStorage between tests
  localStorage.clear()
})

// Mock IndexedDB
vi.mock('dexie', () => ({
  default: class {
    version() {
      return this
    }
    stores() {
      return this
    }
    async open() {
      return Promise.resolve()
    }
    async toArray() {
      return []
    }
    async get() {
      return undefined
    }
    async put() {
      return
    }
    async update() {
      return
    }
    async delete() {
      return
    }
    table() {
      return this
    }
    where() {
      return this
    }
    equals() {
      return this
    }
    orderBy() {
      return this
    }
    last() {
      return Promise.resolve(undefined)
    }
  },
  Dexie: {
    current: {
      version: () => ({}),
      stores: () => ({}),
    },
  },
}))
