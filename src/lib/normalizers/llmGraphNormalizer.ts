/**
 * LLM 图谱响应标准化器
 *
 * 职责：将 LLM 返回的 ref-based 数据转换为 local ID-based 数据
 * 规则：LLM 的 ref 永不直接作为图内主键
 */

import type {
  KnowledgeNode,
  KnowledgeEdge,
  RelationType,
  LLMKnowledgeResponseV2
} from '@/types'
import { generateId } from '@/lib/utils'

// 标准化后的图谱补丁
export interface GraphPatch {
  rootNodeId: string
  rootNodeUpdates: Partial<KnowledgeNode>
  newNodes: KnowledgeNode[]
  newEdges: KnowledgeEdge[]
  graphName?: string
}

// 标准化上下文
export interface NormalizeContext {
  targetGraphId: string
  targetNodeId: string      // 临时节点/占位节点的本地 ID
  topic: string
  operationType: 'create_graph' | 'expand_node'
}

/**
 * 标准化 LLM V2 响应
 *
 * @param response - LLM 返回的原始响应
 * @param context - 标准化上下文
 * @returns GraphPatch - 可直接应用的图谱补丁
 */
export function normalizeLLMResponse(
  response: LLMKnowledgeResponseV2,
  context: NormalizeContext
): GraphPatch {
  const { nodes, edges } = response
  const { targetNodeId } = context

  // 1. 找到 root 节点（LLM 返回的 ref='root'）
  const rootLLMNode = nodes.find(n => n.ref === 'root')
  if (!rootLLMNode) {
    throw new Error('LLM 响应中缺少 root 节点')
  }

  // 2. 建立 ref -> localId 映射
  const refToLocalId = new Map<string, string>()

  // root 使用传入的 targetNodeId（保持 ID 不变）
  refToLocalId.set('root', targetNodeId)

  // 其他节点生成新的本地 ID
  nodes.forEach((node) => {
    if (node.ref !== 'root') {
      refToLocalId.set(node.ref, generateId())
    }
  })

  // 3. 转换节点（使用本地 ID）
  const newNodes: KnowledgeNode[] = []

  nodes.forEach((llmNode) => {
    const localId = refToLocalId.get(llmNode.ref)!

    // root 节点不加入 newNodes（它是更新，不是新增）
    if (llmNode.ref !== 'root') {
      newNodes.push({
        id: localId,
        title: llmNode.title,
        description: llmNode.description,
        type: llmNode.type,
        difficulty: llmNode.difficulty,
        estimatedTime: llmNode.estimatedTime,
        resources: llmNode.resources,
        tags: llmNode.tags,
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        operationStatus: 'success',
      })
    }
  })

  // 4. 转换边（使用本地 ID）
  const newEdges: KnowledgeEdge[] = edges.map((llmEdge) => {
    const sourceId = refToLocalId.get(llmEdge.sourceRef)
    const targetId = refToLocalId.get(llmEdge.targetRef)

    if (!sourceId || !targetId) {
      console.warn(`[Normalizer] 边引用了不存在的节点: ${llmEdge.sourceRef} -> ${llmEdge.targetRef}`)
    }

    return {
      id: generateId(),
      source: sourceId || targetNodeId,
      target: targetId || targetNodeId,
      type: llmEdge.type as RelationType,
      weight: llmEdge.weight,
    }
  })

  // 5. 构建 root 节点的更新
  const rootNodeUpdates: Partial<KnowledgeNode> = {
    title: rootLLMNode.title,
    description: rootLLMNode.description,
    type: rootLLMNode.type,
    difficulty: rootLLMNode.difficulty,
    estimatedTime: rootLLMNode.estimatedTime,
    resources: rootLLMNode.resources,
    tags: rootLLMNode.tags,
    expanded: true,
    operationStatus: 'success',
  }

  return {
    rootNodeId: targetNodeId,
    rootNodeUpdates,
    newNodes,
    newEdges,
    graphName: rootLLMNode.title,
  }
}

/**
 * 标准化骨架响应（用于 expandNode 第一阶段）
 */
export interface SkeletonNormalizeResult {
  skeletonNodes: KnowledgeNode[]
  skeletonEdges: KnowledgeEdge[]
  nodeTitleMap: Map<string, string>  // title -> localId
}

export function normalizeSkeletonResponse(
  relatedTitles: Array<{ title: string; type: string; relation: string }>,
  parentNodeId: string
): SkeletonNormalizeResult {
  const skeletonNodes: KnowledgeNode[] = []
  const skeletonEdges: KnowledgeEdge[] = []
  const nodeTitleMap = new Map<string, string>()

  relatedTitles.forEach((r) => {
    const localId = generateId()
    nodeTitleMap.set(r.title, localId)

    // 创建骨架节点
    skeletonNodes.push({
      id: localId,
      title: r.title,
      description: '',  // 空描述表示正在加载
      type: r.type as KnowledgeNode['type'],
      difficulty: 3,
      expanded: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      operationStatus: 'pending',  // 骨架节点标记为 pending
    })

    // 创建边
    skeletonEdges.push({
      id: generateId(),
      source: r.relation === 'prerequisite' ? localId : parentNodeId,
      target: r.relation === 'prerequisite' ? parentNodeId : localId,
      type: r.relation as RelationType,
      weight: 0.7,
    })
  })

  return { skeletonNodes, skeletonEdges, nodeTitleMap }
}

/**
 * 标准化深度信息响应（用于 expandNode 第二阶段）
 */
export function normalizeDeepInfoResponse(
  _nodeTitle: string,
  deepInfo: {
    description?: string
    estimatedTime?: number
    principle?: string
    useCases?: string[]
    examples?: Array<{ title: string; code?: string; explanation: string }>
    bestPractices?: string[]
    commonMistakes?: string[]
    keyTerms?: Array<{ term: string; definition: string }>
  }
): Partial<KnowledgeNode> {
  return {
    description: deepInfo.description,
    estimatedTime: deepInfo.estimatedTime,
    ...(deepInfo.principle && { principle: deepInfo.principle }),
    ...(deepInfo.useCases && { useCases: deepInfo.useCases }),
    ...(deepInfo.examples && { examples: deepInfo.examples }),
    ...(deepInfo.bestPractices && { bestPractices: deepInfo.bestPractices }),
    ...(deepInfo.commonMistakes && { commonMistakes: deepInfo.commonMistakes }),
    ...(deepInfo.keyTerms && { keyTerms: deepInfo.keyTerms }),
  }
}
