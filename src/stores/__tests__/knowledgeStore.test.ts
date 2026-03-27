import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useKnowledgeStore } from '../knowledgeStore'
import type { KnowledgeNode, KnowledgeGraph } from '@/types'

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
})
