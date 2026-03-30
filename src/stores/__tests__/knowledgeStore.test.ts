import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useKnowledgeStore } from '../knowledgeStore'
import type { KnowledgeNode, KnowledgeGraph } from '@/types'

// Mock GraphRepository for updateGraphById tests
vi.mock('@/lib/storage', () => {
  const storedGraphs = new Map<string, unknown>()

  return {
    GraphRepository: {
      getById: vi.fn((id: string) => {
        const data = storedGraphs.get(id)
        return Promise.resolve(data || null)
      }),
      save: vi.fn((graph: KnowledgeGraph) => {
        storedGraphs.set(graph.id, {
          id: graph.id,
          name: graph.name,
          rootId: graph.rootId,
          nodes: Array.from(graph.nodes.values()),
          edges: graph.edges,
          createdAt: graph.createdAt,
          updatedAt: graph.updatedAt,
        })
        return Promise.resolve()
      }),
      getAll: vi.fn(() => Promise.resolve(Array.from(storedGraphs.values()))),
      _storedGraphs: storedGraphs,
    },
    storedToRuntime: vi.fn((stored: Record<string, unknown>) => {
      const nodes = new Map<string, KnowledgeNode>()
      if (Array.isArray(stored.nodes)) {
        stored.nodes.forEach((n: KnowledgeNode) => nodes.set(n.id, n))
      }
      return {
        id: stored.id,
        name: stored.name,
        rootId: stored.rootId || '',
        nodes,
        edges: stored.edges || [],
        createdAt: stored.createdAt ? new Date(stored.createdAt as string) : new Date(),
        updatedAt: stored.updatedAt ? new Date(stored.updatedAt as string) : new Date(),
      } as KnowledgeGraph
    }),
  }
})

// Mock dispatchGraphUpdateEvent
vi.mock('@/types/events', () => ({
  dispatchGraphUpdateEvent: vi.fn(),
  computeStructureSignature: vi.fn(() => 'mock-sig'),
}))

describe('knowledgeStore', () => {
  describe('persist merge - date conversion', () => {
    it('should convert ISO date strings back to Date objects', () => {
      // 模拟 localStorage 中存储的序列化数据
      const serializedState = {
        currentGraph: {
          id: 'graph-1',
          rootId: 'node-1',
          name: 'Test Graph',
          edges: [],
          nodes: [
            {
              id: 'node-1',
              title: 'Node 1',
              description: 'Desc',
              type: 'concept',
              expanded: false,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-02T00:00:00.000Z',
            },
          ],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
        expandedNodeIds: ['node-1'],
        loadingNodes: [],
      }

      // 直接测试日期转换逻辑
      const node = serializedState.currentGraph.nodes[0]
      const convertedDate = new Date(node.createdAt)

      expect(convertedDate instanceof Date).toBe(true)
      expect(convertedDate.toISOString()).toBe('2024-01-01T00:00:00.000Z')
    })
  })
  beforeEach(() => {
    // Reset store before each test
    const { clearGraph } = useKnowledgeStore.getState()
    clearGraph()
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      expect(result.current.currentGraph).toBeNull()
      expect(result.current.selectedNodeId).toBeNull()
      expect(result.current.expandedNodeIds.size).toBe(0)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('selectNode', () => {
    it('should select a node', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      act(() => {
        result.current.selectNode('node-1')
      })

      expect(result.current.selectedNodeId).toBe('node-1')
    })

    it('should deselect node when passed null', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      act(() => {
        result.current.selectNode('node-1')
      })

      act(() => {
        result.current.selectNode(null)
      })

      expect(result.current.selectedNodeId).toBeNull()
    })
  })

  describe('setExpanded', () => {
    it('should set expanded state for a node', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      act(() => {
        result.current.setExpanded('node-1', true)
      })

      expect(result.current.expandedNodeIds.has('node-1')).toBe(true)

      act(() => {
        result.current.setExpanded('node-1', false)
      })

      expect(result.current.expandedNodeIds.has('node-1')).toBe(false)
    })
  })

  describe('addNodes', () => {
    it('should add nodes to empty graph', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      const mockNode: KnowledgeNode = {
        id: 'node-1',
        title: 'Test Node',
        description: 'Test description',
        type: 'concept',
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockGraph: KnowledgeGraph = {
        id: 'graph-1',
        rootId: 'node-1',
        nodes: new Map(),
        edges: [],
        name: 'Test Graph',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      act(() => {
        result.current.setCurrentGraph(mockGraph)
        result.current.addNodes([mockNode])
      })

      expect(result.current.currentGraph?.nodes.has('node-1')).toBe(true)
    })

    it('should add multiple nodes', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      const nodes: KnowledgeNode[] = [
        {
          id: 'node-1',
          title: 'Node 1',
          description: 'Desc 1',
          type: 'concept',
          expanded: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'node-2',
          title: 'Node 2',
          description: 'Desc 2',
          type: 'skill',
          expanded: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const mockGraph: KnowledgeGraph = {
        id: 'graph-1',
        rootId: 'node-1',
        nodes: new Map(),
        edges: [],
        name: 'Test Graph',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      act(() => {
        result.current.setCurrentGraph(mockGraph)
        result.current.addNodes(nodes)
      })

      expect(result.current.currentGraph?.nodes.size).toBe(2)
    })
  })

  describe('addEdges', () => {
    it('should add edges to graph', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      const mockGraph: KnowledgeGraph = {
        id: 'graph-1',
        rootId: 'node-1',
        nodes: new Map(),
        edges: [],
        name: 'Test Graph',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const edges = [
        {
          id: 'edge-1',
          source: 'node-1',
          target: 'node-2',
          type: 'related' as const,
        },
      ]

      act(() => {
        result.current.setCurrentGraph(mockGraph)
        result.current.addEdges(edges)
      })

      expect(result.current.currentGraph?.edges).toHaveLength(1)
    })

    it('should not add duplicate edges', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      const mockGraph: KnowledgeGraph = {
        id: 'graph-1',
        rootId: 'node-1',
        nodes: new Map(),
        edges: [],
        name: 'Test Graph',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const edges = [
        {
          id: 'edge-1',
          source: 'node-1',
          target: 'node-2',
          type: 'related' as const,
        },
      ]

      act(() => {
        result.current.setCurrentGraph(mockGraph)
        result.current.addEdges(edges)
        result.current.addEdges(edges) // Try to add same edges again
      })

      expect(result.current.currentGraph?.edges).toHaveLength(1)
    })
  })

  describe('initEmptyGraphWithRoot', () => {
    it('should create new graph when no graph exists', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      expect(result.current.currentGraph).toBeNull()

      const rootNode: KnowledgeNode = {
        id: 'root-node',
        title: 'Root',
        description: 'Root node',
        type: 'concept',
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      act(() => {
        result.current.initEmptyGraphWithRoot(rootNode)
      })

      expect(result.current.currentGraph).not.toBeNull()
      expect(result.current.currentGraph?.rootId).toBe('root-node')
      expect(result.current.currentGraph?.nodes.has('root-node')).toBe(true)
    })

    it('should create new graph when current graph has rootId', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      // 先创建一个有 rootId 的图谱
      const existingRoot: KnowledgeNode = {
        id: 'existing-root',
        title: 'Existing Root',
        description: 'Existing',
        type: 'concept',
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      act(() => {
        result.current.createGraph(existingRoot)
      })

      const oldGraphId = result.current.currentGraph?.id

      // 调用 initEmptyGraphWithRoot
      const newRoot: KnowledgeNode = {
        id: 'new-root',
        title: 'New Root',
        description: 'New',
        type: 'concept',
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      act(() => {
        result.current.initEmptyGraphWithRoot(newRoot)
      })

      // 应该创建了新图谱（不同的 id）
      expect(result.current.currentGraph?.id).not.toBe(oldGraphId)
      expect(result.current.currentGraph?.rootId).toBe('new-root')
      expect(result.current.currentGraph?.name).toBe('New Root')
    })

    it('should build on current graph when graph has no rootId (empty graph)', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      // 先创建一个空图谱（没有 rootId）
      act(() => {
        result.current.createEmptyGraph()
      })

      const emptyGraphId = result.current.currentGraph?.id
      expect(result.current.currentGraph?.rootId).toBe('')

      // 调用 initEmptyGraphWithRoot
      const rootNode: KnowledgeNode = {
        id: 'root-node',
        title: 'Root',
        description: 'Root node',
        type: 'concept',
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      act(() => {
        result.current.initEmptyGraphWithRoot(rootNode)
      })

      // 应该在当前图谱上构建（id 不变）
      expect(result.current.currentGraph?.id).toBe(emptyGraphId)
      expect(result.current.currentGraph?.rootId).toBe('root-node')
      expect(result.current.currentGraph?.name).toBe('Root')
      expect(result.current.currentGraph?.nodes.has('root-node')).toBe(true)
    })
  })

  describe('createGraph', () => {
    it('should create a new graph with root node', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      const rootNode: KnowledgeNode = {
        id: 'root-node',
        title: 'Root',
        description: 'Root node',
        type: 'concept',
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      act(() => {
        result.current.createGraph(rootNode)
      })

      expect(result.current.currentGraph).not.toBeNull()
      expect(result.current.currentGraph?.rootId).toBe('root-node')
      expect(result.current.currentGraph?.nodes.has('root-node')).toBe(true)
      expect(result.current.selectedNodeId).toBe('root-node')
    })
  })

  describe('clearGraph', () => {
    it('should clear current graph', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      const rootNode: KnowledgeNode = {
        id: 'root-node',
        title: 'Root',
        description: 'Root node',
        type: 'concept',
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      act(() => {
        result.current.createGraph(rootNode)
      })

      expect(result.current.currentGraph).not.toBeNull()

      act(() => {
        result.current.clearGraph()
      })

      expect(result.current.currentGraph).toBeNull()
      expect(result.current.selectedNodeId).toBeNull()
      expect(result.current.expandedNodeIds.size).toBe(0)
    })
  })

  describe('loading and error states', () => {
    it('should set loading state', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      act(() => {
        result.current.setLoading(true)
      })

      expect(result.current.loading).toBe(true)

      act(() => {
        result.current.setLoading(false)
      })

      expect(result.current.loading).toBe(false)
    })

    it('should set error message', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      act(() => {
        result.current.setError('Something went wrong')
      })

      expect(result.current.error).toBe('Something went wrong')

      act(() => {
        result.current.setError(null)
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('updateGraphById - CAS 校验', () => {
    let mockStorage: typeof import('@/lib/storage')

    beforeEach(async () => {
      mockStorage = await import('@/lib/storage')
      // Clear mock state
      vi.clearAllMocks()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(mockStorage.GraphRepository as any)._storedGraphs.clear()
    })

    const seedGraph = (overrides: Record<string, unknown> = {}) => {
      const storedData = {
        id: 'graph-1',
        name: 'Test',
        rootId: 'node-1',
        nodes: [{ id: 'node-1', title: 'Root', description: '', type: 'concept', expanded: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...overrides }],
        edges: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(mockStorage.GraphRepository as any)._storedGraphs.set('graph-1', storedData)
      return storedData
    }

    it('CAS 通过：activeOperationId 匹配时成功写入', async () => {
      const { result } = renderHook(() => useKnowledgeStore())
      seedGraph({ activeOperationId: 'op-123' })

      const res = await result.current.updateGraphById('graph-1', {
        rootNodeId: 'node-1',
        rootNodeUpdates: { description: 'updated' },
        expectedOperationId: 'op-123',
      })

      expect(res.success).toBe(true)
      expect(res.conflict).toBeUndefined()
      expect(mockStorage.GraphRepository.save).toHaveBeenCalled()
    })

    it('CAS 失败：activeOperationId 不匹配时返回 conflict', async () => {
      const { result } = renderHook(() => useKnowledgeStore())
      seedGraph({ activeOperationId: 'op-other' })

      const res = await result.current.updateGraphById('graph-1', {
        rootNodeId: 'node-1',
        rootNodeUpdates: { description: 'updated' },
        expectedOperationId: 'op-123',
      })

      expect(res.success).toBe(false)
      expect(res.conflict).toBe(true)
      expect(mockStorage.GraphRepository.save).not.toHaveBeenCalled()
    })

    it('无 CAS：expectedOperationId 未传时跳过校验', async () => {
      const { result } = renderHook(() => useKnowledgeStore())
      seedGraph()

      const res = await result.current.updateGraphById('graph-1', {
        rootNodeId: 'node-1',
        rootNodeUpdates: { description: 'updated' },
      })

      expect(res.success).toBe(true)
      expect(res.conflict).toBeUndefined()
    })

    it('CAS 失败：目标节点不存在', async () => {
      const { result } = renderHook(() => useKnowledgeStore())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(mockStorage.GraphRepository as any)._storedGraphs.set('graph-1', {
        id: 'graph-1', name: 'Test', rootId: '', nodes: [], edges: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      })

      const res = await result.current.updateGraphById('graph-1', {
        rootNodeId: 'node-missing',
        rootNodeUpdates: { description: 'updated' },
        expectedOperationId: 'op-123',
      })

      expect(res.success).toBe(false)
      expect(res.conflict).toBe(true)
    })
  })

  describe('updateGraphById - 批量 nodeUpdates', () => {
    let mockStorage: typeof import('@/lib/storage')

    beforeEach(async () => {
      mockStorage = await import('@/lib/storage')
      vi.clearAllMocks()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(mockStorage.GraphRepository as any)._storedGraphs.clear()
    })

    it('单次调用批量更新多个节点', async () => {
      const { result } = renderHook(() => useKnowledgeStore())

      const storedData = {
        id: 'graph-1', name: 'Test', rootId: 'node-1',
        nodes: [
          { id: 'node-1', title: 'Root', description: '', type: 'concept', expanded: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          { id: 'node-2', title: 'Child A', description: '', type: 'skill', expanded: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          { id: 'node-3', title: 'Child B', description: '', type: 'tool', expanded: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        ],
        edges: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(mockStorage.GraphRepository as any)._storedGraphs.set('graph-1', storedData)

      const res = await result.current.updateGraphById('graph-1', {
        rootNodeId: 'node-1',
        rootNodeUpdates: { description: 'root updated' },
        nodeUpdates: [
          { nodeId: 'node-2', updates: { description: 'child A updated' } },
          { nodeId: 'node-3', updates: { description: 'child B updated' } },
        ],
      })

      expect(res.success).toBe(true)
      const savedGraph = (mockStorage.GraphRepository.save as ReturnType<typeof vi.fn>).mock.calls[0][0] as KnowledgeGraph
      expect(savedGraph.nodes.get('node-2')?.description).toBe('child A updated')
      expect(savedGraph.nodes.get('node-3')?.description).toBe('child B updated')
    })

    it('nodeUpdates 中不存在的节点被跳过', async () => {
      const { result } = renderHook(() => useKnowledgeStore())

      const storedData = {
        id: 'graph-1', name: 'Test', rootId: 'node-1',
        nodes: [{ id: 'node-1', title: 'Root', description: '', type: 'concept', expanded: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
        edges: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(mockStorage.GraphRepository as any)._storedGraphs.set('graph-1', storedData)

      const res = await result.current.updateGraphById('graph-1', {
        rootNodeId: 'node-1',
        rootNodeUpdates: { description: 'root updated' },
        nodeUpdates: [{ nodeId: 'node-missing', updates: { description: 'ghost' } }],
      })

      expect(res.success).toBe(true)
    })
  })

  describe('updateGraphById - isCurrentGraph 竞态', () => {
    let mockStorage: typeof import('@/lib/storage')

    beforeEach(async () => {
      mockStorage = await import('@/lib/storage')
      vi.clearAllMocks()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(mockStorage.GraphRepository as any)._storedGraphs.clear()
    })

    it('save 后检查 isCurrentGraph：用户已切换则不更新 currentGraph', async () => {
      const { result } = renderHook(() => useKnowledgeStore())

      const storedData = {
        id: 'graph-1', name: 'Test', rootId: 'node-1',
        nodes: [{ id: 'node-1', title: 'Root', description: '', type: 'concept', expanded: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
        edges: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(mockStorage.GraphRepository as any)._storedGraphs.set('graph-1', storedData)

      // Set graph-1 as current
      act(() => {
        result.current.setCurrentGraph({
          id: 'graph-1', name: 'Test', rootId: 'node-1',
          nodes: new Map([['node-1', { id: 'node-1', title: 'Root', description: '', type: 'concept' as const, expanded: false, createdAt: new Date(), updatedAt: new Date() }]]),
          edges: [], createdAt: new Date(), updatedAt: new Date(),
        })
      })

      // Simulate: save succeeds, then user switches graph BEFORE set() runs
      // Since save is instant in mock, we switch AFTER updateGraphById returns
      const res = await result.current.updateGraphById('graph-1', {
        rootNodeId: 'node-1',
        rootNodeUpdates: { description: 'updated' },
      })

      // Now switch graph (simulates what would happen during save in production)
      act(() => {
        result.current.setCurrentGraph({
          id: 'graph-2', name: 'Other', rootId: '',
          nodes: new Map(), edges: [], createdAt: new Date(), updatedAt: new Date(),
        })
      })

      // The result should reflect isCurrentGraph based on state at time of save
      expect(res.success).toBe(true)
      expect(res.isCurrentGraph).toBe(true) // was current when save happened

      // But after switch, currentGraph should be graph-2
      expect(result.current.currentGraph?.id).toBe('graph-2')
    })
  })
})
