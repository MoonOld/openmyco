/**
 * Operation Service
 *
 * 统一的操作管理服务，负责：
 * - 创建图谱
 * - 展开节点
 * - 操作状态管理
 * - 定向写入图谱
 *
 * 依赖方向：UI → Service → Store
 * 红线：Store 不允许 import Service
 */

import { useKnowledgeStore } from '@/stores/knowledgeStore'
import { useOperationStore } from '@/stores/operationStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { createLLMClient } from '@/lib/llm'
import { generateId } from '@/lib/utils'
import type { KnowledgeNode, KnowledgeEdge } from '@/types'
import { normalizeLLMResponse } from '@/lib/normalizers/llmGraphNormalizer'
import { dispatchGraphUpdateEvent } from '@/types/events'

// 操作结果
export interface OperationResult {
  success: boolean
  operationId: string
  graphId: string
  graphName?: string
  error?: string
  wasCurrentGraph: boolean  // 操作完成时是否是当前图谱
}

/**
 * 创建新图谱
 */
export async function createGraph(topic: string): Promise<OperationResult> {
  // 1. 获取配置
  const { llmConfig } = useSettingsStore.getState()
  if (!llmConfig.apiKey) {
    return {
      success: false,
      operationId: '',
      graphId: '',
      error: '请先配置 API Key',
      wasCurrentGraph: false,
    }
  }

  // 2. 先生成 operationId，用于 CAS 锁
  const operationId = generateId()
  const tempNodeId = generateId()

  // 3. 创建临时节点（含 activeOperationId）
  const tempNode: KnowledgeNode = {
    id: tempNodeId,
    title: topic,
    description: '正在生成知识图谱...',
    type: 'concept',
    expanded: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    operationStatus: 'pending',
    activeOperationId: operationId,
  }

  // 4. 创建空图谱并设置临时节点
  const { initEmptyGraphWithRoot } = useKnowledgeStore.getState()
  initEmptyGraphWithRoot(tempNode)

  const graphId = useKnowledgeStore.getState().currentGraph!.id

  // 5. 记录操作
  useOperationStore.getState().startOperation({
    id: operationId,
    targetGraphId: graphId,
    targetNodeId: tempNodeId,
    type: 'create_graph',
    topic,
  })

  // 6. 立即保存到 IndexedDB
  const { GraphRepository } = await import('@/lib/storage')
  await GraphRepository.save(useKnowledgeStore.getState().currentGraph!)

  // 触发结构变更事件（新图谱创建）
  dispatchGraphUpdateEvent({
    graphId,
    mutationType: 'structure',
    hasNewNodes: true,
    sourceOperationId: operationId,
    timestamp: Date.now(),
  })

  try {
    // 6. 调用 LLM
    const client = createLLMClient(llmConfig)
    const response = await client.generateKnowledgeGraphV2(topic)

    if (!response) {
      useOperationStore.getState().failOperation(operationId, 'LLM 未返回数据')
      // 更新主节点状态为失败，清除 activeOperationId（带 CAS）
      await useKnowledgeStore.getState().updateGraphById(graphId, {
        rootNodeId: tempNodeId,
        rootNodeUpdates: {
          operationStatus: 'failed',
          operationError: '未能获取知识图谱，请重试',
          activeOperationId: undefined,
        },
        mutationType: 'meta',
        expectedOperationId: operationId,
      })
      return {
        success: false,
        operationId,
        graphId,
        error: '未能获取知识图谱，请重试',
        wasCurrentGraph: true,
      }
    }

    // 7. 标准化响应
    const patch = normalizeLLMResponse(response, {
      targetGraphId: graphId,
      targetNodeId: tempNodeId,
      topic,
      operationType: 'create_graph',
    })

    // 8. 并发安全校验： 检查操作是否仍然有效
    const currentOp = useOperationStore.getState().getOperation(operationId)
    if (!currentOp || currentOp.status !== 'pending') {
      console.log('[OperationService] 操作已被取消或替换，放弃写入')
      return {
        success: false,
        operationId,
        graphId,
        error: '操作已取消',
        wasCurrentGraph: false,
      }
    }

    // 9. 定向写入图谱（带 CAS 校验）
    const result = await useKnowledgeStore.getState().updateGraphById(graphId, {
      rootNodeId: patch.rootNodeId,
      rootNodeUpdates: {
        ...patch.rootNodeUpdates,
        operationStatus: 'success',
        operationError: undefined,
        activeOperationId: undefined,  // 操作完成，释放 CAS 锁
      },
      newNodes: patch.newNodes,
      newEdges: patch.newEdges,
      graphName: patch.graphName,
      mutationType: 'structure',  // 新建图谱，始终是结构变更
      sourceOperationId: operationId,
      expectedOperationId: operationId,
    })

    // 9. 更新操作状态
    if (result.success) {
      useOperationStore.getState().completeOperation(operationId)
    } else {
      useOperationStore.getState().failOperation(operationId, result.error || '更新图谱失败')
    }

    return {
      success: result.success,
      operationId,
      graphId,
      graphName: result.graphName,
      error: result.error,
      wasCurrentGraph: result.isCurrentGraph ?? false,
    }
  } catch (error) {
    useOperationStore.getState().failOperation(
      operationId,
      error instanceof Error ? error.message : '未知错误'
    )
    // 更新主节点状态为失败，清除 activeOperationId（带 CAS）
    await useKnowledgeStore.getState().updateGraphById(graphId, {
      rootNodeId: tempNodeId,
      rootNodeUpdates: {
        operationStatus: 'failed',
        operationError: error instanceof Error ? error.message : '生成知识图谱时出错',
        activeOperationId: undefined,
      },
      mutationType: 'meta',
      expectedOperationId: operationId,
    }).catch(() => {
      // CAS 失败时忽略（操作已被新操作取代）
    })
    return {
      success: false,
      operationId,
      graphId,
      error: error instanceof Error ? error.message : '生成知识图谱时出错',
      wasCurrentGraph: true,
    }
  }
}

/**
 * 展开节点
 */
export async function expandNode(nodeId: string): Promise<OperationResult> {
  const store = useKnowledgeStore.getState()
  const graph = store.currentGraph

  if (!graph || !graph.nodes.has(nodeId)) {
    return {
      success: false,
      operationId: '',
      graphId: '',
      error: '节点不存在',
      wasCurrentGraph: false,
    }
  }

  const node = graph.nodes.get(nodeId)!

  // 检查是否正在加载
  if (store.loadingNodes.has(nodeId)) {
    return {
      success: false,
      operationId: '',
      graphId: graph.id,
      error: '节点正在加载中',
      wasCurrentGraph: true,
    }
  }

  // 检查是否已展开（跳过失败节点，允许重试）
  const isFailed = node.operationStatus === 'failed'
  if (store.expandedNodeIds.has(nodeId) && !isFailed) {
    return {
      success: false,
      operationId: '',
      graphId: graph.id,
      error: '节点已展开',
      wasCurrentGraph: true,
    }
  }

  // 设置 loading 状态
  store.setLoading(true)
  const loadingNodes = new Set(store.loadingNodes)
  loadingNodes.add(nodeId)
  useKnowledgeStore.setState({ loadingNodes })

  // 如果是重试失败节点，重置状态
  if (isFailed) {
    await store.updateGraphById(graph.id, {
      rootNodeId: nodeId,
      rootNodeUpdates: {
        operationStatus: 'pending',
        operationError: undefined,
      },
    })
  }

  const graphId = graph.id

  // 记录操作
  const operationId = generateId()
  useOperationStore.getState().startOperation({
    id: operationId,
    targetGraphId: graphId,
    targetNodeId: nodeId,
    type: 'expand_node',
    topic: node.title,
  })

  // 写入 activeOperationId 到节点（获取 CAS 锁）
  await useKnowledgeStore.getState().updateGraphById(graphId, {
    rootNodeId: nodeId,
    rootNodeUpdates: {
      activeOperationId: operationId,
      operationStatus: 'pending',
      operationError: undefined,
    },
    mutationType: 'meta',
  })

  let skeletonNodeMap: Map<string, string> | undefined

  try {
    const { llmConfig } = useSettingsStore.getState()
    if (!llmConfig.apiKey) {
      throw new Error('请先配置 API Key')
    }

    const client = createLLMClient(llmConfig)

    // ========== Step 1: 获取骨架 ==========
    const skeleton = await client.getKnowledgeSkeleton(node.title)
    if (!skeleton) {
      throw new Error(`无法获取 "${node.title}" 的知识骨架`)
    }

    // 创建骨架节点
    const skeletonNodes: KnowledgeNode[] = skeleton.relatedTitles.map((r) => ({
      id: generateId(),
      title: r.title,
      description: '',
      type: r.type as KnowledgeNode['type'],
      difficulty: 3,
      expanded: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      operationStatus: 'pending' as const,
    }))

    // 记录骨架节点映射
    skeletonNodeMap = new Map<string, string>()
    skeleton.relatedTitles.forEach((r, i) => {
      skeletonNodeMap!.set(r.title, skeletonNodes[i]!.id)
    })

    // 创建骨架边
    const skeletonEdges: KnowledgeEdge[] = skeleton.relatedTitles.map((r) => {
      const skeletonNodeId = skeletonNodeMap!.get(r.title)!
      return {
        id: generateId(),
        source: r.relation === 'prerequisite' ? skeletonNodeId : nodeId,
        target: r.relation === 'prerequisite' ? nodeId : skeletonNodeId,
        type: r.relation as KnowledgeEdge['type'],
        weight: 0.7,
      }
    })

    // 定向写入骨架（第一阶段）- 结构变更（带 CAS）
    await useKnowledgeStore.getState().updateGraphById(graphId, {
      rootNodeId: nodeId,
      rootNodeUpdates: { expanded: true },
      newNodes: skeletonNodes,
      newEdges: skeletonEdges,
      mutationType: 'structure',
      sourceOperationId: operationId,
      expectedOperationId: operationId,
    })

    // ========== Step 2: 并行获取深度信息 ==========
    const relatedTitles = skeleton.relatedTitles.map((r) => r.title)

    const [deepInfo, relatedInfo] = await Promise.all([
      client.getKnowledgeDeep(skeleton.node.title, skeleton.node.briefDescription),
      client.getRelatedKnowledge(skeleton.node.title, relatedTitles),
    ])

    // 并发安全校验：检查操作是否仍然有效
    const currentOp = useOperationStore.getState().getOperation(operationId)
    if (!currentOp || currentOp.status !== 'pending') {
      console.log('[OperationService] 操作已被取消或替换，放弃更新')
      return {
        success: false,
        operationId,
        graphId,
        error: '操作已取消',
        wasCurrentGraph: useKnowledgeStore.getState().currentGraph?.id === graphId,
      }
    }

    // ========== Step 3: 批量更新节点内容 ==========
    // 合并主节点 + 关联节点为一次写入，减少 IndexedDB 往返和竞态窗口
    const rootNodeUpdates: Partial<KnowledgeNode> = {
      operationStatus: 'success' as const,
      operationError: undefined,
      activeOperationId: undefined,  // 操作完成，释放 CAS 锁
    }
    if (deepInfo?.description) {
      Object.assign(rootNodeUpdates, {
        description: deepInfo.description,
        estimatedTime: deepInfo.estimatedTime,
        ...(deepInfo.principle && { principle: deepInfo.principle }),
        ...(deepInfo.useCases && { useCases: deepInfo.useCases }),
        ...(deepInfo.examples && { examples: deepInfo.examples }),
        ...(deepInfo.bestPractices && { bestPractices: deepInfo.bestPractices }),
        ...(deepInfo.commonMistakes && { commonMistakes: deepInfo.commonMistakes }),
      })
    }

    // 关联节点更新列表
    const batchNodeUpdates: Array<{ nodeId: string; updates: Partial<KnowledgeNode> }> = []
    if (relatedInfo) {
      relatedInfo.forEach((info) => {
        const skeletonNodeId = skeletonNodeMap!.get(info.title)
        if (skeletonNodeId) {
          batchNodeUpdates.push({
            nodeId: skeletonNodeId,
            updates: {
              description: info.description,
              difficulty: info.difficulty as 1 | 2 | 3 | 4 | 5,
              type: info.type as KnowledgeNode['type'],
              operationStatus: 'success',
            },
          })
        }
      })
    }

    // 一次批量写入所有节点内容（带 CAS）
    await useKnowledgeStore.getState().updateGraphById(graphId, {
      rootNodeId: nodeId,
      rootNodeUpdates,
      nodeUpdates: batchNodeUpdates,
      mutationType: 'content',
      sourceOperationId: operationId,
      expectedOperationId: operationId,
    })

    // 标记展开完成
    useKnowledgeStore.getState().setExpanded(nodeId, true)

    // 完成操作
    useOperationStore.getState().completeOperation(operationId)

    return {
      success: true,
      operationId,
      graphId,
      graphName: graph.name,
      wasCurrentGraph: useKnowledgeStore.getState().currentGraph?.id === graphId,
    }
  } catch (error) {
    // 先检查操作是否仍然有效，再标记失败
    const currentOp = useOperationStore.getState().getOperation(operationId)
    if (currentOp?.status === 'pending') {
      useOperationStore.getState().failOperation(
        operationId,
        error instanceof Error ? error.message : '未知错误'
      )
    }

    // 标记主节点为失败，清除 activeOperationId
    const errorMessage = error instanceof Error ? error.message : '展开节点时出错'
    const batchFailUpdates: Array<{ nodeId: string; updates: Partial<KnowledgeNode> }> = []

    // 骨架节点也标记为 failed
    if (skeletonNodeMap) {
      skeletonNodeMap.forEach((skeletonNodeId) => {
        batchFailUpdates.push({
          nodeId: skeletonNodeId,
          updates: {
            operationStatus: 'failed',
            operationError: errorMessage,
          },
        })
      })
    }

    await useKnowledgeStore.getState().updateGraphById(graphId, {
      rootNodeId: nodeId,
      rootNodeUpdates: {
        operationStatus: 'failed',
        operationError: errorMessage,
        activeOperationId: undefined,
      },
      nodeUpdates: batchFailUpdates,
      mutationType: 'meta',
      sourceOperationId: operationId,
      expectedOperationId: operationId,
    }).catch(() => {
      // CAS 校验失败时忽略（操作已被新操作取代）
    })

    return {
      success: false,
      operationId,
      graphId,
      error: errorMessage,
      wasCurrentGraph: useKnowledgeStore.getState().currentGraph?.id === graphId,
    }
  } finally {
    // 清除 loading 状态
    const loadingNodes = new Set(useKnowledgeStore.getState().loadingNodes)
    loadingNodes.delete(nodeId)
    useKnowledgeStore.setState({ loadingNodes, loading: false })
  }
}

/**
 * 恢复未完成的操作（页面加载时调用）
 * 从 IndexedDB 读取所有图谱，检查 pending 节点
 */
export async function resumePendingOperations(): Promise<void> {
  const { GraphRepository } = await import('@/lib/storage')
  const { storedToRuntime } = await import('@/lib/storage')

  const allStored = await GraphRepository.getAll()
  let totalPending = 0

  for (const stored of allStored) {
    const graph = storedToRuntime(stored)
    const pendingNodes = Array.from(graph.nodes.values()).filter(
      (node) => node.operationStatus === 'pending'
    )

    if (pendingNodes.length === 0) continue
    totalPending += pendingNodes.length

    for (const node of pendingNodes) {
      await useKnowledgeStore.getState().updateGraphById(graph.id, {
        rootNodeId: node.id,
        rootNodeUpdates: {
          operationStatus: 'failed',
          operationError: '操作中断，请点击重试',
          activeOperationId: undefined,
        },
        mutationType: 'meta',
      })
    }
  }

  if (totalPending > 0) {
    console.log(`[OperationService] 恢复完成：${totalPending} 个节点标记为失败`)
  }
}
