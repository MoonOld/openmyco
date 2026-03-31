/**
 * Operation Service
 *
 * 统一的操作管理服务，负责：
 * - 创建图谱
 * - 展开节点（expandOnly：骨架获取 + 去重 + 写入节点/边）
 * - 深化节点（deepenOnly：深度信息 + 关联描述 + 写入内容）
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
import { dedupSkeleton, canonicalizeTitle } from '@/lib/llm/dedup'
import { generateId } from '@/lib/utils'
import type { KnowledgeNode } from '@/types'
import { normalizeLLMResponse } from '@/lib/normalizers/llmGraphNormalizer'
import { dispatchGraphUpdateEvent } from '@/types/events'
import type { UpdateGraphResult } from '@/stores/knowledgeStore'

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
 * 辅助函数：扩展操作状态转换
 */
async function transitionExpandStatus(
  nodeId: string,
  graphId: string,
  status: 'pending' | 'success' | 'failed',
  options?: {
    error?: string
    activeExpandOpId?: string
    mutationType?: 'structure' | 'content' | 'meta'
    expectedExpandOpId?: string
    nodeUpdates?: Array<{ nodeId: string; updates: Partial<KnowledgeNode> }>
    sourceOperationId?: string
  }
): Promise<UpdateGraphResult> {
  return useKnowledgeStore.getState().updateGraphById(graphId, {
    rootNodeId: nodeId,
    rootNodeUpdates: {
      expandStatus: status,
      expandError: options?.error,
      activeExpandOpId: options?.activeExpandOpId,
    },
    nodeUpdates: options?.nodeUpdates,
    mutationType: options?.mutationType ?? 'meta',
    sourceOperationId: options?.sourceOperationId,
    expectedExpandOpId: options?.expectedExpandOpId,
  })
}

/**
 * 辅助函数：深化操作状态转换
 */
async function transitionDeepenStatus(
  nodeId: string,
  graphId: string,
  status: 'pending' | 'success' | 'failed',
  options?: {
    error?: string
    activeDeepenOpId?: string
    mutationType?: 'structure' | 'content' | 'meta'
    expectedDeepenOpId?: string
    nodeUpdates?: Array<{ nodeId: string; updates: Partial<KnowledgeNode> }>
    sourceOperationId?: string
  }
): Promise<UpdateGraphResult> {
  return useKnowledgeStore.getState().updateGraphById(graphId, {
    rootNodeId: nodeId,
    rootNodeUpdates: {
      deepenStatus: status,
      deepenError: options?.error,
      activeDeepenOpId: options?.activeDeepenOpId,
    },
    nodeUpdates: options?.nodeUpdates,
    mutationType: options?.mutationType ?? 'meta',
    sourceOperationId: options?.sourceOperationId,
    expectedDeepenOpId: options?.expectedDeepenOpId,
  })
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

  // 3. 创建临时节点（含 activeExpandOpId）
  const tempNode: KnowledgeNode = {
    id: tempNodeId,
    title: topic,
    description: '正在生成知识图谱...',
    type: 'concept',
    expanded: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    expandStatus: 'pending',
    activeExpandOpId: operationId,
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
      // 更新主节点状态为失败，清除 activeExpandOpId（带 CAS）
      await transitionExpandStatus(tempNodeId, graphId, 'failed', {
        error: '未能获取知识图谱，请重试',
        expectedExpandOpId: operationId,
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
        expandStatus: 'success',
        expandError: undefined,
        activeExpandOpId: undefined,  // 操作完成，释放 CAS 锁
      },
      newNodes: patch.newNodes,
      newEdges: patch.newEdges,
      graphName: patch.graphName,
      mutationType: 'structure',  // 新建图谱，始终是结构变更
      sourceOperationId: operationId,
      expectedExpandOpId: operationId,
    })

    // 标记扩展完成
    useKnowledgeStore.getState().setExpanded(tempNodeId, true)

    // 9. 更新操作状态
    if (result.success) {
      useOperationStore.getState().completeOperation(operationId)

      // 10. 自动深化根节点（createGraph 只获取骨架，深度内容需要额外调用）
      deepenOnly(tempNodeId).catch((err) => {
        console.warn('[createGraph] 自动深化根节点失败:', err)
      })
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
    // 更新主节点状态为失败，清除 activeExpandOpId（带 CAS）
    await transitionExpandStatus(tempNodeId, graphId, 'failed', {
      error: error instanceof Error ? error.message : '生成知识图谱时出错',
      expectedExpandOpId: operationId,
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
 * 扩展节点（只做骨架：获取关联节点标题 → 去重 → 创建新节点和边）
 * 不获取深度内容，用户需要单独调用 deepenOnly 获取
 */
export async function expandOnly(nodeId: string): Promise<OperationResult> {
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
      error: '节点正在扩展中',
      wasCurrentGraph: true,
    }
  }

  // 检查是否已扩展（跳过失败节点，允许重试）
  const isExpandFailed = node.expandStatus === 'failed' || node.operationStatus === 'failed'
  if (store.expandedNodeIds.has(nodeId) && !isExpandFailed) {
    return {
      success: false,
      operationId: '',
      graphId: graph.id,
      error: '节点已扩展',
      wasCurrentGraph: true,
    }
  }

  // 设置 loading 状态
  store.setLoading(true)
  const loadingNodes = new Set(store.loadingNodes)
  loadingNodes.add(nodeId)
  useKnowledgeStore.setState({ loadingNodes })

  const graphId = graph.id
  const operationId = generateId()

  // 记录操作
  useOperationStore.getState().startOperation({
    id: operationId,
    targetGraphId: graphId,
    targetNodeId: nodeId,
    type: 'expand_node',
    topic: node.title,
  })

  // 写入 activeExpandOpId 到节点（获取扩展 CAS 锁）
  await transitionExpandStatus(nodeId, graphId, 'pending', {
    activeExpandOpId: operationId,
    mutationType: 'meta',
  })

  let skeletonNodeMap: Map<string, string> | undefined
  let newNodeIds: Set<string> | undefined

  try {
    const { llmConfig } = useSettingsStore.getState()
    if (!llmConfig.apiKey) {
      throw new Error('请先配置 API Key')
    }

    const client = createLLMClient(llmConfig)

    // ========== Step 1: 获取骨架 ==========
    const adjacentNodeIds = new Set(
      graph.edges
        .filter(e => e.source === nodeId || e.target === nodeId)
        .map(e => e.source === nodeId ? e.target : e.source)
    )
    const adjacentTitles = Array.from(adjacentNodeIds)
      .map(id => graph.nodes.get(id)?.title)
      .filter(Boolean) as string[]

    const existingNodeTitles = Array.from(graph.nodes.values()).map(n => n.title)

    const skeleton = await client.expandSkeleton(
      node.title, node.description || '', adjacentTitles, existingNodeTitles
    )
    if (!skeleton) {
      throw new Error(`无法获取 "${node.title}" 的知识骨架`)
    }

    // 去重处理
    const dedupResult = dedupSkeleton(skeleton.relatedTitles, nodeId, graph.nodes, graph.edges)
    const skeletonNodes = dedupResult.newNodes
    newNodeIds = new Set(skeletonNodes.map(n => n.id))
    const skeletonEdges = dedupResult.newEdges
    skeletonNodeMap = dedupResult.nodeTitleMap

    if (dedupResult.duplicatesFound > 0) {
      console.log(`[expandOnly] Dedup: reused ${dedupResult.duplicatesFound} existing nodes`)
    }

    // 为新节点标记 expandStatus
    skeletonNodes.forEach(n => {
      n.expandStatus = 'pending' as const
    })

    // 并发安全校验
    const currentOp = useOperationStore.getState().getOperation(operationId)
    if (!currentOp || currentOp.status !== 'pending') {
      console.log('[expandOnly] 操作已被取消或替换，放弃写入')
      return {
        success: false,
        operationId,
        graphId,
        error: '操作已取消',
        wasCurrentGraph: useKnowledgeStore.getState().currentGraph?.id === graphId,
      }
    }

    // 定向写入骨架（结构变更，带 CAS）
    await useKnowledgeStore.getState().updateGraphById(graphId, {
      rootNodeId: nodeId,
      rootNodeUpdates: {
        expanded: true,
        expandStatus: 'success',
        expandError: undefined,
        activeExpandOpId: undefined,  // 扩展完成，释放 CAS 锁
      },
      newNodes: skeletonNodes,
      newEdges: skeletonEdges,
      mutationType: 'structure',
      sourceOperationId: operationId,
      expectedExpandOpId: operationId,
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

    // 标记主节点为失败，清除 activeExpandOpId
    const errorMessage = error instanceof Error ? error.message : '扩展节点时出错'
    const batchFailUpdates: Array<{ nodeId: string; updates: Partial<KnowledgeNode> }> = []

    // 骨架节点也标记为 failed（只标记新创建的，跳过去重复用的节点）
    if (skeletonNodeMap) {
      skeletonNodeMap.forEach((skeletonNodeId) => {
        const isNewNode = newNodeIds?.has(skeletonNodeId)
        if (isNewNode) {
          batchFailUpdates.push({
            nodeId: skeletonNodeId,
            updates: {
              expandStatus: 'failed',
              expandError: errorMessage,
            },
          })
        }
      })
    }

    await transitionExpandStatus(nodeId, graphId, 'failed', {
      error: errorMessage,
      nodeUpdates: batchFailUpdates,
      sourceOperationId: operationId,
      expectedExpandOpId: operationId,
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
 * 深化节点（只做深度内容：getKnowledgeDeep + getRelatedKnowledge）
 * 不创建新节点/边，只更新已有节点的内容字段
 */
export async function deepenOnly(nodeId: string, options?: { force?: boolean }): Promise<OperationResult> {
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

  // 需要有描述才能深化
  if (!node.description) {
    return {
      success: false,
      operationId: '',
      graphId: graph.id,
      error: '节点无描述，无法深化',
      wasCurrentGraph: true,
    }
  }

  // 检查是否正在深化
  if (store.loadingDeepenNodes.has(nodeId)) {
    return {
      success: false,
      operationId: '',
      graphId: graph.id,
      error: '节点正在深化中',
      wasCurrentGraph: true,
    }
  }

  // 检查是否已深化（跳过失败节点，允许重试；force=true 时跳过拦截）
  const isDeepenFailed = node.deepenStatus === 'failed'
  if (store.deepenedNodeIds.has(nodeId) && !isDeepenFailed && !options?.force) {
    return {
      success: false,
      operationId: '',
      graphId: graph.id,
      error: '节点已深化',
      wasCurrentGraph: true,
    }
  }

  // 设置 loading 状态
  const loadingDeepenNodes = new Set(store.loadingDeepenNodes)
  loadingDeepenNodes.add(nodeId)
  useKnowledgeStore.setState({ loadingDeepenNodes })

  const graphId = graph.id
  const operationId = generateId()

  // 记录操作
  useOperationStore.getState().startOperation({
    id: operationId,
    targetGraphId: graphId,
    targetNodeId: nodeId,
    type: 'deepen_node',
    topic: node.title,
  })

  // 写入 activeDeepenOpId 到节点（获取深化 CAS 锁）
  await transitionDeepenStatus(nodeId, graphId, 'pending', {
    activeDeepenOpId: operationId,
    mutationType: 'meta',
  })

  try {
    const { llmConfig } = useSettingsStore.getState()
    if (!llmConfig.apiKey) {
      throw new Error('请先配置 API Key')
    }

    const client = createLLMClient(llmConfig)

    // 获取关联节点标题（从已有边中获取）
    const adjacentNodeIds = new Set(
      graph.edges
        .filter(e => e.source === nodeId || e.target === nodeId)
        .map(e => e.source === nodeId ? e.target : e.source)
    )
    const relatedTitles = Array.from(adjacentNodeIds)
      .map(id => graph.nodes.get(id)?.title)
      .filter(Boolean) as string[]

    const subTopicTitles = node.subTopics?.map(st => st.title)

    // 并行获取深度信息（支持部分成功）
    const [deepInfoResult, relatedInfoResult] = await Promise.allSettled([
      client.getKnowledgeDeep(node.title, node.description, relatedTitles, subTopicTitles),
      client.getRelatedKnowledge(node.title, relatedTitles),
    ])

    const deepInfo = deepInfoResult.status === 'fulfilled' ? deepInfoResult.value : null
    const relatedInfo = relatedInfoResult.status === 'fulfilled' ? relatedInfoResult.value : null
    const deepInfoError = deepInfoResult.status === 'rejected' ? deepInfoResult.reason : null
    const relatedInfoError = relatedInfoResult.status === 'rejected' ? relatedInfoResult.reason : null

    // 两个都失败 → throw
    if (!deepInfo && !relatedInfo) {
      const errorMsg = deepInfoError instanceof Error ? deepInfoError.message
        : relatedInfoError instanceof Error ? relatedInfoError.message
        : '获取知识信息失败'
      throw new Error(errorMsg)
    }

    // 部分成功时记录 warn 日志
    if (deepInfoError) {
      console.warn('[deepenOnly] getKnowledgeDeep 失败，仅使用 relatedInfo:', deepInfoError)
    }
    if (relatedInfoError) {
      console.warn('[deepenOnly] getRelatedKnowledge 失败，仅使用 deepInfo:', relatedInfoError)
    }

    // 并发安全校验
    const opBeforeUpdate = useOperationStore.getState().getOperation(operationId)
    if (!opBeforeUpdate || opBeforeUpdate.status !== 'pending') {
      console.log('[deepenOnly] 操作已被取消或替换，放弃更新')
      return {
        success: false,
        operationId,
        graphId,
        error: '操作已取消',
        wasCurrentGraph: useKnowledgeStore.getState().currentGraph?.id === graphId,
      }
    }

    // 批量更新节点内容
    const rootNodeUpdates: Partial<KnowledgeNode> = {
      deepenStatus: 'success' as const,
      deepenError: undefined,
      activeDeepenOpId: undefined,  // 操作完成，释放 CAS 锁
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
        ...(deepInfo.keyTerms && { keyTerms: deepInfo.keyTerms }),
        ...(deepInfo.subTopics && { subTopics: deepInfo.subTopics }),
      })
    }

    // 关联节点更新列表（补充描述）
    const batchNodeUpdates: Array<{ nodeId: string; updates: Partial<KnowledgeNode> }> = []
    if (relatedInfo) {
      relatedInfo.forEach((info) => {
        // 通过标题查找关联节点
        const canonicalTitle = canonicalizeTitle(info.title)
        const targetNodeId = canonicalTitle
          ? findNodeIdByCanonicalTitle(graph.nodes, canonicalTitle)
          : undefined
        if (targetNodeId) {
          const existingNode = graph.nodes.get(targetNodeId)
          // 只补充空字段
          if (existingNode && !existingNode.description) {
            batchNodeUpdates.push({
              nodeId: targetNodeId,
              updates: {
                description: info.description,
                difficulty: info.difficulty as 1 | 2 | 3 | 4 | 5,
                type: info.type as KnowledgeNode['type'],
              },
            })
          }
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
      expectedDeepenOpId: operationId,
    })

    // 标记深化完成
    useKnowledgeStore.getState().setDeepened(nodeId, true)

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

    // 标记主节点为失败，清除 activeDeepenOpId
    const errorMessage = error instanceof Error ? error.message : '深化节点时出错'

    await transitionDeepenStatus(nodeId, graphId, 'failed', {
      error: errorMessage,
      sourceOperationId: operationId,
      expectedDeepenOpId: operationId,
    }).catch(() => {
      // CAS 校验失败时忽略
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
    const loadingDeepenNodes = new Set(useKnowledgeStore.getState().loadingDeepenNodes)
    loadingDeepenNodes.delete(nodeId)
    useKnowledgeStore.setState({ loadingDeepenNodes })
  }
}

/**
 * 通过 canonical title 查找节点 ID
 */
function findNodeIdByCanonicalTitle(
  nodes: Map<string, KnowledgeNode>,
  canonicalTitle: string
): string | undefined {
  for (const [id, node] of nodes) {
    if (canonicalizeTitle(node.title) === canonicalTitle) {
      return id
    }
  }
  return undefined
}

/**
 * 展开节点（组合入口：expandOnly → deepenOnly）
 * 保留向后兼容
 */
export async function expandNode(nodeId: string): Promise<OperationResult> {
  // 先扩展
  const expandResult = await expandOnly(nodeId)
  if (!expandResult.success) {
    return expandResult
  }

  // 再深化
  const deepenResult = await deepenOnly(nodeId)

  // 返回深化结果（因为深化是最后执行的）
  return deepenResult
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
      (node) => node.expandStatus === 'pending' || node.deepenStatus === 'pending'
        || node.operationStatus === 'pending'  // 兼容旧数据
    )

    if (pendingNodes.length === 0) continue
    totalPending += pendingNodes.length

    for (const node of pendingNodes) {
      // 同时标记扩展和深化状态
      const updates: Partial<KnowledgeNode> = {}
      if (node.expandStatus === 'pending' || node.operationStatus === 'pending') {
        updates.expandStatus = 'failed'
        updates.expandError = '操作中断，请点击重试'
      }
      if (node.deepenStatus === 'pending') {
        updates.deepenStatus = 'failed'
        updates.deepenError = '操作中断，请点击重试'
      }
      await useKnowledgeStore.getState().updateGraphById(graph.id, {
        rootNodeId: node.id,
        rootNodeUpdates: updates,
        mutationType: 'meta',
      })
    }
  }

  if (totalPending > 0) {
    console.log(`[OperationService] 恢复完成：${totalPending} 个节点标记为失败`)
  }
}
