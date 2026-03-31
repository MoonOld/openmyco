import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { KnowledgeGraph, KnowledgeNode, KnowledgeEdge, KnowledgeQA, QAActionType, MergeableField } from '@/types'
import { arrayToNodes, generateId } from '@/lib/utils'
import { createLLMClient } from '@/lib/llm'
import { dedupSkeleton, canonicalizeTitle } from '@/lib/llm/dedup'
import { useSettingsStore } from './settingsStore'
import { GraphRepository, storedToRuntime } from '@/lib/storage'
import type { GraphMutationType } from '@/types/events'
import { dispatchGraphUpdateEvent } from '@/types/events'

// 操作上下文类型
export interface OperationContext {
  id: string                    // 操作唯一 ID
  targetGraphId: string         // 目标图谱 ID
  tempNodeId: string            // 临时/占位节点 ID
  topic: string                 // 用户输入的主题
  status: 'pending' | 'success' | 'failed' | 'cancelled'
  startedAt: Date
  completedAt?: Date
  error?: string
}

// 定向更新图谱的结果
export interface UpdateGraphResult {
  success: boolean
  isCurrentGraph: boolean       // 是否是当前显示的图谱
  graphName: string             // 图谱名称（用于 toast 提示）
  error?: string
  conflict?: boolean            // CAS 校验失败（并发冲突）
}

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
  qaLoadingNodes: Set<string>  // Nodes currently loading QA
  qaError: string | null

  // Actions
  setCurrentGraph: (graph: KnowledgeGraph | null) => void
  selectNode: (nodeId: string | null) => void
  toggleExpand: (nodeId: string) => void
  setExpanded: (nodeId: string, expanded: boolean) => void
  /** @deprecated Use operationService.expandNode instead — UI 已切换到 operationService */
  expandNode: (nodeId: string) => Promise<void>
  addNodes: (nodes: KnowledgeNode[]) => { added: KnowledgeNode[]; skipped: KnowledgeNode[] }
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
  setQaError: (error: string | null) => void
  askQuestion: (nodeId: string, question: string) => Promise<void>
  executeQAAction: (nodeId: string, qaId: string, action: QAActionType, field?: MergeableField) => void

  // 定向更新方法（不依赖 currentGraph）
  updateGraphById: (
    graphId: string,
    updates: {
      rootNodeId: string
      rootNodeUpdates: Partial<KnowledgeNode>
      newNodes?: KnowledgeNode[]
      newEdges?: KnowledgeEdge[]
      graphName?: string
      mutationType?: GraphMutationType  // 由调用方决定
      sourceOperationId?: string        // 操作来源追踪
      expectedOperationId?: string      // CAS 校验：节点当前的 activeOperationId 应匹配
      nodeUpdates?: Array<{ nodeId: string; updates: Partial<KnowledgeNode> }>  // 批量节点更新
    }
  ) => Promise<UpdateGraphResult>
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
      qaLoadingNodes: new Set<string>(),
      qaError: null,

      // Actions
      setCurrentGraph: (graph) =>
        set({
          currentGraph: graph,
          selectedNodeId: null,
          expandedNodeIds: new Set(),
          // 切换视图时清除 loading 状态（后台操作会继续执行）
          loadingNodes: new Set(),
          loading: false,
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
          // 获取相邻节点标题和全图节点标题
          const adjacentNodeIds = new Set(
            graph.edges
              .filter(e => e.source === nodeId || e.target === nodeId)
              .map(e => e.source === nodeId ? e.target : e.source)
          )
          const adjacentTitles = Array.from(adjacentNodeIds)
            .map(id => graph.nodes.get(id)?.title)
            .filter(Boolean) as string[]

          const existingNodeTitles = Array.from(graph.nodes.values()).map(n => n.title)

          // 使用专用 expand prompt（传入已有节点标题减少重复）
          const skeleton = await client.expandSkeleton(
            node.title, node.description || '', adjacentTitles, existingNodeTitles
          )
          if (!skeleton) {
            set({ error: `无法获取 "${node.title}" 的知识骨架` })
            return
          }

          // 去重处理
          const { newNodes: skeletonNodes, newEdges: skeletonEdges, nodeTitleMap: skeletonNodeMap, duplicatesFound } =
            dedupSkeleton(skeleton.relatedTitles, nodeId, graph.nodes, graph.edges)

          if (duplicatesFound > 0) {
            console.log(`[expandNode] Dedup: reused ${duplicatesFound} existing nodes`)
          }

          // 立即添加骨架节点和边 - 用户此时可以看到结构
          get().addNodes(skeletonNodes)
          get().addEdges(skeletonEdges)

          // ========== Step 2: 并行获取深度信息 ==========
          // 此时用户已经可以看到骨架结构
          const relatedTitles = skeleton.relatedTitles.map(r => r.title)
          const subTopicTitles = skeleton.subTopics?.map(st => st.title)

          const [deepInfo, relatedInfo] = await Promise.all([
            // 线程 A: 获取主节点深度信息
            client.getKnowledgeDeep(skeleton.node.title, skeleton.node.briefDescription, relatedTitles, subTopicTitles),
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
              ...(deepInfo.keyTerms && { keyTerms: deepInfo.keyTerms }),
              ...(deepInfo.subTopics && { subTopics: deepInfo.subTopics }),
            })
          }

          // 更新关联节点描述（对去重复用的节点只补充空字段）
          if (relatedInfo) {
            relatedInfo.forEach((info) => {
              const skeletonNodeId = skeletonNodeMap.get(canonicalizeTitle(info.title))
              if (!skeletonNodeId) return
              const existingNode = get().currentGraph?.nodes.get(skeletonNodeId)
              if (existingNode && !existingNode.description) {
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
        if (!graph) return { added: [] as KnowledgeNode[], skipped: [] as KnowledgeNode[] }

        // 构建 canonical title -> id 映射（最终防线防并发竞态）
        const existingCanonical = new Map<string, string>()
        graph.nodes.forEach((node) => {
          const key = canonicalizeTitle(node.title)
          if (key) existingCanonical.set(key, node.id)
        })

        const added: KnowledgeNode[] = []
        const skipped: KnowledgeNode[] = []
        const newNodes = new Map(graph.nodes)
        for (const node of nodes) {
          const canonical = canonicalizeTitle(node.title)
          if (canonical && existingCanonical.has(canonical)) {
            console.log(`[addNodes] Dedup barrier: skipped "${node.title}" (existing: "${existingCanonical.get(canonical)}")`)
            skipped.push(node)
            continue
          }
          newNodes.set(node.id, node)
          if (canonical) existingCanonical.set(canonical, node.id)
          added.push(node)
        }

        set({
          currentGraph: { ...graph, nodes: newNodes },
        })

        return { added, skipped }
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
        const nodeIds = graph.nodes.keys()
        const nodeIdSet = new Set(Array.from(nodeIds))
        const validEdges = edges.filter((e) =>
          nodeIdSet.has(e.source) && nodeIdSet.has(e.target)
        )
        if (validEdges.length < edges.length) {
          console.log(`[addEdges] Filtered ${edges.length - validEdges.length} dangling edges (source/target not in graph)`)
        }
        const newEdges = validEdges.filter((e) => !existingEdgeIds.has(e.id))

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
        if (!graph || graph.rootId) {
          // 没有图谱或已有主节点，创建新图谱
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
      setQaError: (error) => set({ qaError: error }),

      askQuestion: async (nodeId: string, question: string) => {
        const graph = get().currentGraph
        if (!graph || !graph.nodes.has(nodeId)) return

        const node = graph.nodes.get(nodeId)!

        // Check API key
        const { llmConfig } = useSettingsStore.getState()
        if (!llmConfig.apiKey) {
          set({ qaError: '请先配置 API Key' })
          return
        }

        // Set loading state
        const qaLoadingNodes = new Set(get().qaLoadingNodes)
        qaLoadingNodes.add(nodeId)
        set({ qaLoadingNodes, qaError: null })

        try {
          const client = createLLMClient(llmConfig)

          // Build QA history summary
          const qaHistory = node.qas?.map(qa => ({
            question: qa.question,
            answer: qa.answer.substring(0, 50),
          }))

          const response = await client.askQuestion(
            node.title,
            node.description,
            question,
            qaHistory,
            node.principle?.substring(0, 100)
          )

          if (!response) {
            set({ qaError: 'LLM 返回无效响应' })
            return
          }

          // Create QA record
          const qa: KnowledgeQA = {
            id: generateId(),
            question,
            answer: response.answer,
            action: response.suggestedAction,
            mergedField: response.suggestedField,
            createdAt: new Date(),
          }

          // Append QA to node
          const updatedQAs = [...(node.qas || []), qa]
          get().updateNode(nodeId, { qas: updatedQAs })

          // Save to storage
          const updatedGraph = get().currentGraph
          if (updatedGraph) {
            await GraphRepository.save(updatedGraph)
          }
        } catch (error) {
          console.error('Failed to ask question:', error)
          set({ qaError: error instanceof Error ? error.message : '提问时出错' })
        } finally {
          const qaLoadingNodes = new Set(get().qaLoadingNodes)
          qaLoadingNodes.delete(nodeId)
          set({ qaLoadingNodes })
        }
      },

      executeQAAction: (nodeId: string, qaId: string, action: QAActionType, field?: MergeableField) => {
        const graph = get().currentGraph
        if (!graph || !graph.nodes.has(nodeId)) return

        const node = graph.nodes.get(nodeId)!
        const qa = node.qas?.find(q => q.id === qaId)
        if (!qa) return

        switch (action) {
          case 'save_only': {
            // Just mark the QA as processed
            const updatedQAs = node.qas!.map(q =>
              q.id === qaId ? { ...q, actionResult: 'saved' } : q
            )
            get().updateNode(nodeId, { qas: updatedQAs })
            break
          }

          case 'merge_to_field': {
            if (!field) return
            const updatedQAs = node.qas!.map(q =>
              q.id === qaId ? { ...q, actionResult: `merged_to_${field}`, mergedField: field } : q
            )

            const nodeUpdates: Partial<KnowledgeNode> = { qas: updatedQAs }
            if (field === 'principle') {
              const existing = node.principle || ''
              nodeUpdates.principle = existing + (existing ? '\n\n' : '') + `【来自问答】${qa.answer}`
            } else if (field === 'useCases' || field === 'bestPractices' || field === 'commonMistakes') {
              const existing = node[field] || []
              nodeUpdates[field] = [...existing, qa.answer]
            }

            get().updateNode(nodeId, nodeUpdates)
            break
          }

          case 'generate_subtopic': {
            const updatedQAs = node.qas!.map(q =>
              q.id === qaId ? { ...q, actionResult: 'generated_subtopic' } : q
            )

            const title = qa.question.length > 20 ? qa.question.substring(0, 20) + '...' : qa.question
            const description = qa.answer.length > 100 ? qa.answer.substring(0, 100) + '...' : qa.answer
            const newSubTopic = { title, description }

            get().updateNode(nodeId, {
              qas: updatedQAs,
              subTopics: [...(node.subTopics || []), newSubTopic],
            })
            break
          }

          case 'upgrade_to_node': {
            const updatedQAs = node.qas!.map(q =>
              q.id === qaId ? { ...q, actionResult: 'upgraded_to_node' } : q
            )

            const newNodeId = generateId()
            const title = qa.question.length > 30 ? qa.question.substring(0, 30) + '...' : qa.question
            const newNode: KnowledgeNode = {
              id: newNodeId,
              title,
              description: qa.answer,
              type: 'concept',
              expanded: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            }

            const newEdge: KnowledgeEdge = {
              id: generateId(),
              source: nodeId,
              target: newNodeId,
              type: 'related',
              weight: 0.7,
            }

            get().updateNode(nodeId, { qas: updatedQAs })
            const { skipped } = get().addNodes([newNode])
            if (skipped.length > 0) {
              // 节点被去重屏障跳过，更新 actionResult
              const finalQAs = node.qas!.map(q =>
                q.id === qaId ? { ...q, actionResult: 'skipped_duplicate' } : q
              )
              get().updateNode(nodeId, { qas: finalQAs })
            } else {
              get().addEdges([newEdge])
            }
            break
          }
        }

        // Save to storage
        const updatedGraph = get().currentGraph
        if (updatedGraph) {
          GraphRepository.save(updatedGraph)
        }
      },

      /**
       * 定向更新图谱（不依赖 currentGraph）
       * 用于异步操作完成后，将数据写入正确的图谱
       *
       * CAS 机制：若 expectedOperationId 存在，校验目标节点的 activeOperationId 是否匹配。
       * 这可以防止旧的异步操作覆盖新操作的结果。
       */
      updateGraphById: async (graphId, updates) => {
        try {
          // 从 IndexedDB 加载目标图谱
          const stored = await GraphRepository.getById(graphId)
          if (!stored) {
            return {
              success: false,
              isCurrentGraph: false,
              graphName: '',
              error: '目标图谱不存在',
            }
          }

          const graph = storedToRuntime(stored)

          // CAS 校验：检查 activeOperationId 是否匹配
          if (updates.expectedOperationId) {
            const rootNode = graph.nodes.get(updates.rootNodeId)
            if (!rootNode) {
              return {
                success: false,
                isCurrentGraph: false,
                graphName: '',
                error: 'CAS 校验失败：目标节点不存在',
                conflict: true,
              }
            }
            if (rootNode.activeOperationId !== updates.expectedOperationId) {
              return {
                success: false,
                isCurrentGraph: false,
                graphName: '',
                error: 'CAS 校验失败：操作已被替换',
                conflict: true,
              }
            }
          }

          // 更新根节点
          const rootNode = graph.nodes.get(updates.rootNodeId)
          if (rootNode) {
            graph.nodes.set(updates.rootNodeId, {
              ...rootNode,
              ...updates.rootNodeUpdates,
              updatedAt: new Date(),
            })
          }

          // 批量更新其他节点
          if (updates.nodeUpdates) {
            for (const { nodeId, updates: nodeUpd } of updates.nodeUpdates) {
              const node = graph.nodes.get(nodeId)
              if (node) {
                graph.nodes.set(nodeId, {
                  ...node,
                  ...nodeUpd,
                  updatedAt: new Date(),
                })
              }
            }
          }

          // 添加新节点（含 canonical 去重防线）
          if (updates.newNodes) {
            const canonicalMap = new Map<string, string>()
            graph.nodes.forEach((n) => {
              const k = canonicalizeTitle(n.title)
              if (k) canonicalMap.set(k, n.id)
            })
            updates.newNodes.forEach((node) => {
              const canonical = canonicalizeTitle(node.title)
              if (canonical && canonicalMap.has(canonical)) {
                console.log(`[updateGraphById] Dedup: skipped "${node.title}" (existing: "${canonicalMap.get(canonical)}")`)
                return
              }
              graph.nodes.set(node.id, node)
              if (canonical) canonicalMap.set(canonical, node.id)
            })
          }

          // 添加新边（含悬空边过滤）
          if (updates.newEdges) {
            const nodeIdSet = new Set(Array.from(graph.nodes.keys()))
            const existingEdgeKeys = new Set(graph.edges.map((e) => `${e.source}->${e.target}:${e.type}`))
            updates.newEdges.forEach((edge) => {
              if (!nodeIdSet.has(edge.source) || !nodeIdSet.has(edge.target)) {
                console.log(`[updateGraphById] Skipped dangling edge: ${edge.source} -> ${edge.target}`)
                return
              }
              const edgeKey = `${edge.source}->${edge.target}:${edge.type}`
              if (!existingEdgeKeys.has(edgeKey)) {
                graph.edges.push(edge)
                existingEdgeKeys.add(edgeKey)
              }
            })
          }

          // 更新图谱名称
          if (updates.graphName) {
            graph.name = updates.graphName
          }

          graph.updatedAt = new Date()

          // 保存到 IndexedDB
          await GraphRepository.save(graph)

          // isCurrentGraph 在 save 之后重新检查（修复竞态）
          const isCurrentGraph = get().currentGraph?.id === graphId
          if (isCurrentGraph) {
            set({ currentGraph: graph })
          }

          // 确定 mutationType（调用方优先，否则根据更新内容推断）
          const hasNewNodes = (updates.newNodes?.length ?? 0) > 0
          const hasNewEdges = (updates.newEdges?.length ?? 0) > 0
          const mutationType: GraphMutationType = updates.mutationType ?? (
            hasNewNodes || hasNewEdges ? 'structure' : 'content'
          )

          // 触发带 metadata 的事件
          dispatchGraphUpdateEvent({
            graphId,
            mutationType,
            hasNewNodes,
            hasNewEdges,
            sourceOperationId: updates.sourceOperationId,
            timestamp: Date.now(),
          })

          return {
            success: true,
            isCurrentGraph,
            graphName: graph.name,
          }
        } catch (error) {
          return {
            success: false,
            isCurrentGraph: false,
            graphName: '',
            error: error instanceof Error ? error.message : '更新图谱失败',
          }
        }
      },
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
            // Convert qas[].createdAt strings back to Date
            ...(node.qas ? {
              qas: node.qas.map((qa) => ({
                ...qa,
                createdAt: new Date(qa.createdAt),
              }))
            } : {}),
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
