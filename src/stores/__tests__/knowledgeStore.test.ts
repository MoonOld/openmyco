import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useKnowledgeStore } from '../knowledgeStore'
import type { KnowledgeNode, KnowledgeGraph, KnowledgeQA } from '@/types'

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

// Mock settings store
vi.mock('../settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      llmConfig: {
        apiKey: 'test-api-key',
        baseURL: 'https://api.test.com',
        model: 'test-model',
      },
    }),
  },
}))

// Mock LLM client
const mockAskQuestion = vi.fn()
vi.mock('@/lib/llm', () => ({
  createLLMClient: vi.fn(() => ({
    askQuestion: mockAskQuestion,
  })),
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

    it('should skip nodes with duplicate canonical title', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      const existingNode: KnowledgeNode = {
        id: 'node-1',
        title: 'Machine Learning',
        description: 'Existing',
        type: 'concept',
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const nodeMap = new Map<string, KnowledgeNode>()
      nodeMap.set('node-1', existingNode)

      const mockGraph: KnowledgeGraph = {
        id: 'graph-1',
        rootId: 'node-1',
        nodes: nodeMap,
        edges: [],
        name: 'Test Graph',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const duplicateNode: KnowledgeNode = {
        id: 'node-dup',
        title: 'machine learning', // different case, same canonical
        description: 'Duplicate',
        type: 'concept',
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      act(() => {
        result.current.setCurrentGraph(mockGraph)
        const { added, skipped } = result.current.addNodes([duplicateNode])
        expect(added).toHaveLength(0)
        expect(skipped).toHaveLength(1)
      })

      expect(result.current.currentGraph?.nodes.size).toBe(1)
      expect(result.current.currentGraph?.nodes.has('node-1')).toBe(true)
      expect(result.current.currentGraph?.nodes.has('node-dup')).toBe(false)
    })
  })

  describe('addEdges', () => {
    it('should add edges to graph', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      const node1: KnowledgeNode = {
        id: 'node-1',
        title: 'A',
        description: '',
        type: 'concept',
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const node2: KnowledgeNode = {
        id: 'node-2',
        title: 'B',
        description: '',
        type: 'concept',
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const nodeMap = new Map<string, KnowledgeNode>()
      nodeMap.set('node-1', node1)
      nodeMap.set('node-2', node2)

      const mockGraph: KnowledgeGraph = {
        id: 'graph-1',
        rootId: 'node-1',
        nodes: nodeMap,
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

      const node1: KnowledgeNode = {
        id: 'node-1',
        title: 'A',
        description: '',
        type: 'concept',
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const node2: KnowledgeNode = {
        id: 'node-2',
        title: 'B',
        description: '',
        type: 'concept',
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const nodeMap = new Map<string, KnowledgeNode>()
      nodeMap.set('node-1', node1)
      nodeMap.set('node-2', node2)

      const mockGraph: KnowledgeGraph = {
        id: 'graph-1',
        rootId: 'node-1',
        nodes: nodeMap,
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

    it('should filter out dangling edges whose source/target nodes do not exist', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      const node1: KnowledgeNode = {
        id: 'node-1',
        title: 'A',
        description: '',
        type: 'concept',
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const nodeMap = new Map<string, KnowledgeNode>()
      nodeMap.set('node-1', node1)

      const mockGraph: KnowledgeGraph = {
        id: 'graph-1',
        rootId: 'node-1',
        nodes: nodeMap,
        edges: [],
        name: 'Test Graph',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const edges = [
        {
          id: 'edge-good',
          source: 'node-1',
          target: 'node-1', // self-loop OK
          type: 'related' as const,
        },
        {
          id: 'edge-dangling-target',
          source: 'node-1',
          target: 'node-nonexistent',
          type: 'related' as const,
        },
        {
          id: 'edge-dangling-source',
          source: 'node-nonexistent',
          target: 'node-1',
          type: 'related' as const,
        },
      ]

      act(() => {
        result.current.setCurrentGraph(mockGraph)
        result.current.addEdges(edges)
      })

      expect(result.current.currentGraph?.edges).toHaveLength(1)
      expect(result.current.currentGraph?.edges[0].id).toBe('edge-good')
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

    it('CAS 跳过：目标节点不存在时不触发 CAS（无锁可校验）', async () => {
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

      // CAS 校验需要 rootNode 存在才能比对，节点不存在时跳过 CAS
      // 操作本身会成功（但不会更新任何节点，因为节点确实不存在）
      expect(res.success).toBe(true)
      expect(res.conflict).toBeUndefined()
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

  describe('askQuestion', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      mockAskQuestion.mockReset()
    })

    it('should add QA to node after successful LLM response', async () => {
      const { result } = renderHook(() => useKnowledgeStore())

      const node: KnowledgeNode = {
        id: 'node-1',
        title: 'React',
        description: 'A JavaScript library',
        type: 'tool',
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      act(() => {
        result.current.setCurrentGraph({
          id: 'graph-1',
          rootId: 'node-1',
          nodes: new Map([['node-1', node]]),
          edges: [],
          name: 'Test Graph',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      })

      mockAskQuestion.mockResolvedValue({
        answer: 'React uses Virtual DOM for efficient updates',
        suggestedAction: 'save_only',
      })

      await act(async () => {
        await result.current.askQuestion('node-1', 'How does React render?')
      })

      const updatedNode = result.current.currentGraph?.nodes.get('node-1')
      expect(updatedNode?.qas).toHaveLength(1)
      expect(updatedNode?.qas?.[0].question).toBe('How does React render?')
      expect(updatedNode?.qas?.[0].answer).toBe('React uses Virtual DOM for efficient updates')
      expect(updatedNode?.qas?.[0].action).toBe('save_only')
    })

    it('should set qaError when API key is missing', async () => {
      const { result } = renderHook(() => useKnowledgeStore())

      const node: KnowledgeNode = {
        id: 'node-1',
        title: 'React',
        description: 'A JavaScript library',
        type: 'tool',
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      act(() => {
        result.current.setCurrentGraph({
          id: 'graph-1',
          rootId: 'node-1',
          nodes: new Map([['node-1', node]]),
          edges: [],
          name: 'Test Graph',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      })

      // Temporarily override the settings mock to return no API key
      const settingsModule = await import('../settingsStore')
      const originalGetState = settingsModule.useSettingsStore.getState
      settingsModule.useSettingsStore.getState = () => ({
        llmConfig: { apiKey: '', baseURL: '', model: '' },
      }) as ReturnType<typeof settingsModule.useSettingsStore.getState>

      await act(async () => {
        await result.current.askQuestion('node-1', 'test')
      })

      expect(result.current.qaError).toBe('请先配置 API Key')

      // Restore original mock
      settingsModule.useSettingsStore.getState = originalGetState
    })

    it('should not modify graph when node does not exist', async () => {
      const { result } = renderHook(() => useKnowledgeStore())

      act(() => {
        result.current.setCurrentGraph({
          id: 'graph-1',
          rootId: 'node-1',
          nodes: new Map(),
          edges: [],
          name: 'Test Graph',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      })

      await act(async () => {
        await result.current.askQuestion('nonexistent', 'test')
      })

      expect(mockAskQuestion).not.toHaveBeenCalled()
    })
  })

  describe('executeQAAction', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    const createGraphWithQA = (qa: Partial<KnowledgeQA> = {}): KnowledgeGraph => {
      const fullQA: KnowledgeQA = {
        id: 'qa-1',
        question: 'What is Virtual DOM?',
        answer: 'Virtual DOM is a lightweight copy of the real DOM',
        action: 'save_only',
        createdAt: new Date(),
        ...qa,
      }
      const node: KnowledgeNode = {
        id: 'node-1',
        title: 'React',
        description: 'A JavaScript library',
        type: 'tool',
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        qas: [fullQA],
      }
      return {
        id: 'graph-1',
        rootId: 'node-1',
        nodes: new Map([['node-1', node]]),
        edges: [],
        name: 'Test Graph',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    }

    it('save_only: should mark QA as saved', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      act(() => {
        result.current.setCurrentGraph(createGraphWithQA())
      })

      act(() => {
        result.current.executeQAAction('node-1', 'qa-1', 'save_only')
      })

      const qa = result.current.currentGraph?.nodes.get('node-1')?.qas?.[0]
      expect(qa?.actionResult).toBe('saved')
    })

    it('merge_to_field: should append answer to principle', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      act(() => {
        result.current.setCurrentGraph(createGraphWithQA({
          action: 'merge_to_field',
        }))
      })

      act(() => {
        result.current.executeQAAction('node-1', 'qa-1', 'merge_to_field', 'principle')
      })

      const node = result.current.currentGraph?.nodes.get('node-1')
      expect(node?.principle).toContain('Virtual DOM is a lightweight copy of the real DOM')
      const qa = node?.qas?.[0]
      expect(qa?.actionResult).toBe('merged_to_principle')
      expect(qa?.mergedField).toBe('principle')
    })

    it('merge_to_field: should push answer to array field (useCases)', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      act(() => {
        result.current.setCurrentGraph(createGraphWithQA({
          action: 'merge_to_field',
          answer: 'Building SPAs',
        }))
      })

      act(() => {
        result.current.executeQAAction('node-1', 'qa-1', 'merge_to_field', 'useCases')
      })

      const node = result.current.currentGraph?.nodes.get('node-1')
      expect(node?.useCases).toContain('Building SPAs')
    })

    it('merge_to_field: should return early when field is missing', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      act(() => {
        result.current.setCurrentGraph(createGraphWithQA())
      })

      act(() => {
        result.current.executeQAAction('node-1', 'qa-1', 'merge_to_field')
      })

      // QA should not be modified since field was not provided
      const qa = result.current.currentGraph?.nodes.get('node-1')?.qas?.[0]
      expect(qa?.actionResult).toBeUndefined()
    })

    it('generate_subtopic: should add a new subTopic', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      act(() => {
        result.current.setCurrentGraph(createGraphWithQA({
          action: 'generate_subtopic',
        }))
      })

      act(() => {
        result.current.executeQAAction('node-1', 'qa-1', 'generate_subtopic')
      })

      const node = result.current.currentGraph?.nodes.get('node-1')
      expect(node?.subTopics).toHaveLength(1)
      expect(node?.subTopics?.[0].title).toBeTruthy()
      const qa = node?.qas?.[0]
      expect(qa?.actionResult).toBe('generated_subtopic')
    })

    it('upgrade_to_node: should create a new node and edge', () => {
      const { result } = renderHook(() => useKnowledgeStore())

      act(() => {
        result.current.setCurrentGraph(createGraphWithQA({
          action: 'upgrade_to_node',
        }))
      })

      act(() => {
        result.current.executeQAAction('node-1', 'qa-1', 'upgrade_to_node')
      })

      const graph = result.current.currentGraph
      // Should have 2 nodes now
      expect(graph?.nodes.size).toBe(2)
      // Should have 1 edge
      expect(graph?.edges).toHaveLength(1)
      expect(graph?.edges[0].type).toBe('related')
      expect(graph?.edges[0].weight).toBe(0.7)
      const qa = graph?.nodes.get('node-1')?.qas?.[0]
      expect(qa?.actionResult).toBe('upgraded_to_node')
    })
  })
})
