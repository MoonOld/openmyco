import { describe, it, expect } from 'vitest'
import { create } from 'zustand'

// Create a test store without persist middleware
const createTestStore = () =>
  create<{
    expandedNodeIds: Set<string>
    toggleExpand: (nodeId: string) => void
  }>((set, get) => ({
    expandedNodeIds: new Set<string>(),
    toggleExpand: (nodeId) => {
      const expanded = new Set(get().expandedNodeIds)
      if (expanded.has(nodeId)) {
        expanded.delete(nodeId)
      } else {
        expanded.add(nodeId)
      }
      set({ expandedNodeIds: expanded })
    },
  }))

describe('toggleExpand (without persist)', () => {
  it('should add node to expanded set if not present', () => {
    const useStore = createTestStore()
    const store = useStore.getState()

    store.toggleExpand('node-1')

    expect(useStore.getState().expandedNodeIds.has('node-1')).toBe(true)
  })

  it('should remove node from expanded set if present', () => {
    const useStore = createTestStore()
    const store = useStore.getState()

    // First expand
    store.toggleExpand('node-1')
    expect(useStore.getState().expandedNodeIds.has('node-1')).toBe(true)

    // Then collapse
    store.toggleExpand('node-1')
    expect(useStore.getState().expandedNodeIds.has('node-1')).toBe(false)
  })

  it('should handle multiple nodes', () => {
    const useStore = createTestStore()
    const store = useStore.getState()

    store.toggleExpand('node-1')
    store.toggleExpand('node-2')
    store.toggleExpand('node-3')

    const { expandedNodeIds } = useStore.getState()
    expect(expandedNodeIds.size).toBe(3)
    expect(expandedNodeIds.has('node-1')).toBe(true)
    expect(expandedNodeIds.has('node-2')).toBe(true)
    expect(expandedNodeIds.has('node-3')).toBe(true)
  })
})
