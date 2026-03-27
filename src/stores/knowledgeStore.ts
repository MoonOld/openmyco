import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { KnowledgeGraph, KnowledgeNode, KnowledgeEdge } from '@/types'
import { arrayToNodes, generateId } from '@/lib/utils'
import { createLLMClient } from '@/lib/llm'
import { useSettingsStore } from './settingsStore'
import { GraphRepository } from '@/lib/storage'

interface KnowledgeState {
  // State
  currentGraph: KnowledgeGraph | null
  selectedNodeId: string | null
  expandedNodeIds: Set<string>
  loading: boolean
  loadingNodes: Set<string>  // Nodes currently being expanded
  error: string | null
  focusMode: boolean  // Whether to show only focused node and neighbors
  focusDepth: number  // How many degrees of neighbors to show (1 = direct neighbors)

  // Actions
  setCurrentGraph: (graph: KnowledgeGraph | null) => void
  selectNode: (nodeId: string | null) => void
  toggleExpand: (nodeId: string) => void
  setExpanded: (nodeId: string, expanded: boolean) => void
  expandNode: (nodeId: string) => Promise<void>
  addNodes: (nodes: KnowledgeNode[]) => void
  addEdges: (edges: KnowledgeEdge[]) => void
  updateNode: (nodeId: string, updates: Partial<KnowledgeNode>) => void
  removeNode: (nodeId: string) => void
  clearGraph: () => void
  createGraph: (rootNode: KnowledgeNode) => void
  createEmptyGraph: () => void
  isEmptyGraph: () => boolean
  initEmptyGraphWithRoot: (rootNode: KnowledgeNode) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setFocusMode: (enabled: boolean) => void
  setFocusDepth: (depth: number) => void
}

export const useKnowledgeStore = create<KnowledgeState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentGraph: null,
      selectedNodeId: null,
      expandedNodeIds: new Set<string>(),
      loadingNodes: new Set<string>(),
      loading: false,
      error: null,
      focusMode: true,  // Default to focus mode
      focusDepth: 1,    // Show direct neighbors by default

      // Actions
      setCurrentGraph: (graph) =>
        set({
          currentGraph: graph,
          selectedNodeId: null,
          expandedNodeIds: new Set(),
        }),

      selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

      toggleExpand: (nodeId) => {
        const expanded = new Set(get().expandedNodeIds)
        if (expanded.has(nodeId)) {
          expanded.delete(nodeId)
        } else {
          expanded.add(nodeId)
        }
        set({ expandedNodeIds: expanded })
      },

      expandNode: async (nodeId: string) => {
        const graph = get().currentGraph
        if (!graph || !graph.nodes.has(nodeId)) return

        const node = graph.nodes.get(nodeId)!

        // Check if already expanded or currently loading
        if (get().expandedNodeIds.has(nodeId) || get().loadingNodes.has(nodeId)) {
          return
        }

        // Set loading state - 立即显示加载状态
        const loadingNodes = new Set(get().loadingNodes)
        loadingNodes.add(nodeId)
        set({ loadingNodes })

        try {
          const { llmConfig } = useSettingsStore.getState()
          if (!llmConfig.apiKey) {
            set({ error: '请先配置 API Key' })
            return
          }

          const client = createLLMClient(llmConfig)

          // ========== Step 1: 获取骨架 ==========
          // 这是第一个请求，获取后立即渲染骨架节点
          const skeleton = await client.getKnowledgeSkeleton(node.title)
          if (!skeleton) {
            set({ error: `无法获取 "${node.title}" 的知识骨架` })
            return
          }

          // 立即创建并渲染骨架节点
          const skeletonNodes: KnowledgeNode[] = skeleton.relatedTitles.map((r) => ({
            id: generateId(),
            title: r.title,
            description: '', // 空描述表示正在加载
            type: r.type as KnowledgeNode['type'],
            difficulty: 3,
            expanded: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          }))

          // 记录骨架节点 ID，用于后续更新
          const skeletonNodeMap = new Map<string, string>()
          skeleton.relatedTitles.forEach((r, i) => {
            skeletonNodeMap.set(r.title, skeletonNodes[i]!.id)
          })

          // 立即添加骨架节点和边 - 用户此时可以看到结构
          get().addNodes(skeletonNodes)

          const skeletonEdges: KnowledgeEdge[] = skeleton.relatedTitles.map((r) => {
            const skeletonNodeId = skeletonNodeMap.get(r.title)!
            return {
              id: generateId(),
              source: r.relation === 'prerequisite' ? skeletonNodeId : nodeId,
              target: r.relation === 'prerequisite' ? nodeId : skeletonNodeId,
              type: r.relation as KnowledgeEdge['type'],
              weight: 0.7,
            }
          })
          get().addEdges(skeletonEdges)

          // ========== Step 2: 并行获取深度信息 ==========
          // 此时用户已经可以看到骨架结构
          const relatedTitles = skeleton.relatedTitles.map(r => r.title)

          const [deepInfo, relatedInfo] = await Promise.all([
            // 线程 A: 获取主节点深度信息
            client.getKnowledgeDeep(skeleton.node.title, skeleton.node.briefDescription),
            // 线程 B: 获取关联知识描述
            client.getRelatedKnowledge(skeleton.node.title, relatedTitles),
          ])

          // ========== Step 3: 更新节点内容 ==========
          // 更新主节点
          if (deepInfo?.description) {
            get().updateNode(nodeId, {
              description: deepInfo.description,
              estimatedTime: deepInfo.estimatedTime,
              ...(deepInfo.principle && { principle: deepInfo.principle }),
              ...(deepInfo.useCases && { useCases: deepInfo.useCases }),
              ...(deepInfo.examples && { examples: deepInfo.examples }),
              ...(deepInfo.bestPractices && { bestPractices: deepInfo.bestPractices }),
              ...(deepInfo.commonMistakes && { commonMistakes: deepInfo.commonMistakes }),
            })
          }

          // 更新关联节点描述
          if (relatedInfo) {
            relatedInfo.forEach((info) => {
              const skeletonNodeId = skeletonNodeMap.get(info.title)
              if (skeletonNodeId) {
                get().updateNode(skeletonNodeId, {
                  description: info.description,
                  difficulty: info.difficulty as 1 | 2 | 3 | 4 | 5,
                  type: info.type as KnowledgeNode['type'],
                })
              }
            })
          }

          get().setExpanded(nodeId, true)

          // Save to storage
          const updatedGraph = get().currentGraph
          if (updatedGraph) {
            await GraphRepository.save(updatedGraph)
          }
        } catch (error) {
          console.error('Failed to expand node:', error)
          set({ error: error instanceof Error ? error.message : '扩展节点时出错' })
        } finally {
          // Remove from loading state
          const loadingNodes = new Set(get().loadingNodes)
          loadingNodes.delete(nodeId)
          set({ loadingNodes })
        }
      },

      setExpanded: (nodeId, expanded) => {
        const expandedSet = new Set(get().expandedNodeIds)
        if (expanded) {
          expandedSet.add(nodeId)
        } else {
          expandedSet.delete(nodeId)
        }
        set({ expandedNodeIds: expandedSet })
      },

      addNodes: (nodes) => {
        const graph = get().currentGraph
        if (!graph) return

        const newNodes = new Map(graph.nodes)
        nodes.forEach((node) => newNodes.set(node.id, node))

        set({
          currentGraph: { ...graph, nodes: newNodes },
        })
      },

      addEdges: (edges) => {
        const graph = get().currentGraph
        if (!graph) {
          console.log('[addEdges] No current graph, skipping')
          return
        }

        console.log('[addEdges] Input edges:', edges.length)
        console.log('[addEdges] Current edges:', graph.edges.length)

        const existingEdgeIds = new Set(graph.edges.map((e) => e.id))
        const newEdges = edges.filter((e) => !existingEdgeIds.has(e.id))

        console.log('[addEdges] New edges to add:', newEdges.length)

        set({
          currentGraph: { ...graph, edges: [...graph.edges, ...newEdges] },
        })

        const updatedGraph = get().currentGraph
        console.log('[addEdges] After update - edges:', updatedGraph?.edges.length)
      },

      updateNode: (nodeId, updates) => {
        const graph = get().currentGraph
        if (!graph || !graph.nodes.has(nodeId)) return

        const node = graph.nodes.get(nodeId)!
        const updatedNode: KnowledgeNode = {
          ...node,
          ...updates,
          updatedAt: new Date(),
        }

        const newNodes = new Map(graph.nodes)
        newNodes.set(nodeId, updatedNode)

        set({
          currentGraph: { ...graph, nodes: newNodes },
        })
      },

      removeNode: (nodeId) => {
        const graph = get().currentGraph
        if (!graph) return

        const newNodes = new Map(graph.nodes)
        newNodes.delete(nodeId)

        const newEdges = graph.edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId
        )

        set({
          currentGraph: { ...graph, nodes: newNodes, edges: newEdges },
        })
      },

      clearGraph: () =>
        set({
          currentGraph: null,
          selectedNodeId: null,
          expandedNodeIds: new Set(),
        }),

      createGraph: (rootNode) => {
        const graphId = generateId()
        const graph: KnowledgeGraph = {
          id: graphId,
          rootId: rootNode.id,
          nodes: new Map([[rootNode.id, rootNode]]),
          edges: [],
          name: rootNode.title,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        set({ currentGraph: graph, selectedNodeId: rootNode.id })
      },

      createEmptyGraph: () => {
        const graphId = generateId()
        const graph: KnowledgeGraph = {
          id: graphId,
          rootId: '',
          nodes: new Map(),
          edges: [],
          name: '新图谱',
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        set({ currentGraph: graph, selectedNodeId: null, expandedNodeIds: new Set() })
      },

      isEmptyGraph: () => {
        const graph = get().currentGraph
        if (!graph) return true
        // 空图谱：没有节点
        return graph.nodes.size === 0
      },

      initEmptyGraphWithRoot: (rootNode: KnowledgeNode) => {
        const graph = get().currentGraph
        if (!graph || graph.nodes.size > 0) {
          // 不是空图谱，创建新图谱
          get().createGraph(rootNode)
          return
        }
        // 空图谱，初始化根节点
        const updatedGraph: KnowledgeGraph = {
          ...graph,
          rootId: rootNode.id,
          nodes: new Map([[rootNode.id, rootNode]]),
          name: rootNode.title,
          updatedAt: new Date(),
        }
        set({ currentGraph: updatedGraph, selectedNodeId: rootNode.id })
      },

      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      setFocusMode: (enabled) => set({ focusMode: enabled }),
      setFocusDepth: (depth) => set({ focusDepth: depth }),
    }),
    {
      name: 'knowledge-storage',
      partialize: (state) => ({
        currentGraph: state.currentGraph
          ? {
              ...state.currentGraph,
              nodes: Array.from(state.currentGraph.nodes.values()),
            }
          : null,
        expandedNodeIds: Array.from(state.expandedNodeIds),
        loadingNodes: Array.from(state.loadingNodes),
      }),
      merge: (persistedState: unknown, currentState: KnowledgeState) => {
        const state = persistedState as {
          currentGraph?: {
            nodes: Array<KnowledgeNode & { createdAt: string; updatedAt: string }>
            createdAt?: string
            updatedAt?: string
          }
          expandedNodeIds?: string[]
          loadingNodes?: string[]
        }

        const result: Partial<KnowledgeState> = {}

        // Rehydrate Map from array and convert date strings back to Date objects
        if (state.currentGraph?.nodes) {
          const nodesWithDates = state.currentGraph.nodes.map((node) => ({
            ...node,
            createdAt: new Date(node.createdAt),
            updatedAt: new Date(node.updatedAt),
          }))
          result.currentGraph = {
            ...state.currentGraph,
            nodes: arrayToNodes(nodesWithDates),
            createdAt: state.currentGraph.createdAt
              ? new Date(state.currentGraph.createdAt)
              : new Date(),
            updatedAt: state.currentGraph.updatedAt
              ? new Date(state.currentGraph.updatedAt)
              : new Date(),
          } as KnowledgeState['currentGraph']
        }

        // Rehydrate Sets from arrays
        result.expandedNodeIds = state.expandedNodeIds
          ? new Set(state.expandedNodeIds)
          : new Set()

        result.loadingNodes = state.loadingNodes
          ? new Set(state.loadingNodes)
          : new Set()

        return { ...currentState, ...result }
      },
    }
  )
)
