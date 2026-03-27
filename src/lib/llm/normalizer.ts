/**
 * ID Normalizer - 将 LLM 返回的 ref 转换为本地 canonical ID
 *
 * 核心思想：
 * - LLM 返回稳定的 ref（如 "root", "n1", "n2"）
 * - 前端完全控制 ID 生成
 * - ref 只是外部引用，不直接用于存储
 */

import { generateId } from '@/lib/utils'
import type {
  LLMKnowledgeResponseV2,
  NormalizedKnowledgeResponse,
  KnowledgeNode,
  RelationType,
} from '@/types'

/**
 * 将 LLM 响应（使用 ref）转换为本地数据结构（使用 canonical ID）
 *
 * @param response LLM 返回的原始响应
 * @param rootCanonicalId 主节点的本地 ID（通常来自临时节点）
 * @returns 标准化后的数据结构
 */
export function normalizeLLMResponse(
  response: LLMKnowledgeResponseV2,
  rootCanonicalId: string
): NormalizedKnowledgeResponse {
  console.log('[Normalizer] Input response:', response)
  console.log('[Normalizer] Root canonical ID:', rootCanonicalId)

  // 1. 建立 ref -> canonicalId 映射
  const refMapping = new Map<string, string>()

  // 主节点使用传入的 canonical ID
  refMapping.set('root', rootCanonicalId)

  // 为其他节点生成新的 canonical ID
  response.nodes.forEach((node) => {
    if (node.ref !== 'root' && !refMapping.has(node.ref)) {
      refMapping.set(node.ref, generateId())
    }
  })

  console.log('[Normalizer] Ref mapping:', Object.fromEntries(refMapping))

  // 2. 转换节点
  const now = new Date()
  let rootNode: KnowledgeNode | null = null
  const relatedNodes: KnowledgeNode[] = []

  response.nodes.forEach((llmNode) => {
    const canonicalId = refMapping.get(llmNode.ref)
    if (!canonicalId) {
      console.warn('[Normalizer] No canonical ID for ref:', llmNode.ref)
      return
    }

    const knowledgeNode: KnowledgeNode = {
      id: canonicalId,
      title: llmNode.title,
      description: llmNode.description,
      type: llmNode.type,
      difficulty: llmNode.difficulty,
      estimatedTime: llmNode.estimatedTime,
      resources: llmNode.resources || [],
      tags: llmNode.tags || [],
      expanded: false,
      createdAt: now,
      updatedAt: now,
    }

    if (llmNode.ref === 'root') {
      // 主节点标记为已展开
      knowledgeNode.expanded = true
      rootNode = knowledgeNode
    } else {
      relatedNodes.push(knowledgeNode)
    }
  })

  if (!rootNode) {
    console.error('[Normalizer] No root node found in response')
    throw new Error('LLM response must include a root node')
  }

  // 3. 转换边
  const edges = response.edges
    .map((llmEdge) => {
      const source = refMapping.get(llmEdge.sourceRef)
      const target = refMapping.get(llmEdge.targetRef)

      if (!source || !target) {
        console.warn(
          '[Normalizer] Edge references unknown node:',
          llmEdge.sourceRef,
          '->',
          llmEdge.targetRef
        )
        return null
      }

      return {
        source,
        target,
        type: llmEdge.type,
        weight: llmEdge.weight,
      }
    })
    .filter((edge): edge is NonNullable<typeof edge> => edge !== null)

  console.log('[Normalizer] Normalized edges:', edges.length)

  return {
    rootNode,
    relatedNodes,
    edges,
    refMapping,
  }
}

/**
 * 从旧格式 LLM 响应中提取节点列表
 * （兼容旧版本的 prompt 格式）
 */
export function normalizeLegacyResponse(
  response: {
    node: {
      title: string
      description: string
      type: string
      difficulty: number
      estimatedTime?: number
    }
    prerequisites?: Array<{
      title: string
      description: string
      type: string
      difficulty: number
    }>
    postrequisites?: Array<{
      title: string
      description: string
      type: string
      difficulty: number
    }>
    related?: Array<{
      title: string
      description: string
      type: string
      difficulty: number
    }>
    relations?: Array<{
      from: string
      to: string
      type: string
      weight?: number
    }>
  },
  rootCanonicalId: string
): NormalizedKnowledgeResponse {
  console.log('[Normalizer] Normalizing legacy response')

  // 建立 title -> ref 的映射
  const titleToRef = new Map<string, string>()
  titleToRef.set(response.node.title, 'root')

  let refCounter = 1
  const getNextRef = () => `n${refCounter++}`

  // 为其他节点分配 ref
  ;(response.prerequisites || []).forEach((n) => {
    if (!titleToRef.has(n.title)) {
      titleToRef.set(n.title, getNextRef())
    }
  })
  ;(response.postrequisites || []).forEach((n) => {
    if (!titleToRef.has(n.title)) {
      titleToRef.set(n.title, getNextRef())
    }
  })
  ;(response.related || []).forEach((n) => {
    if (!titleToRef.has(n.title)) {
      titleToRef.set(n.title, getNextRef())
    }
  })

  // 转换为 V2 格式
  const v2Response: LLMKnowledgeResponseV2 = {
    nodes: [
      {
        ref: 'root',
        title: response.node.title,
        description: response.node.description,
        type: response.node.type as 'concept' | 'skill' | 'tool' | 'theory',
        difficulty: response.node.difficulty as 1 | 2 | 3 | 4 | 5,
        estimatedTime: response.node.estimatedTime,
      },
      ...(response.prerequisites || []).map((n) => ({
        ref: titleToRef.get(n.title)!,
        title: n.title,
        description: n.description,
        type: n.type as 'concept' | 'skill' | 'tool' | 'theory',
        difficulty: n.difficulty as 1 | 2 | 3 | 4 | 5,
      })),
      ...(response.postrequisites || []).map((n) => ({
        ref: titleToRef.get(n.title)!,
        title: n.title,
        description: n.description,
        type: n.type as 'concept' | 'skill' | 'tool' | 'theory',
        difficulty: n.difficulty as 1 | 2 | 3 | 4 | 5,
      })),
      ...(response.related || []).map((n) => ({
        ref: titleToRef.get(n.title)!,
        title: n.title,
        description: n.description,
        type: n.type as 'concept' | 'skill' | 'tool' | 'theory',
        difficulty: n.difficulty as 1 | 2 | 3 | 4 | 5,
      })),
    ],
    edges: (response.relations || []).map((r) => ({
      sourceRef: titleToRef.get(r.from) || r.from,
      targetRef: titleToRef.get(r.to) || r.to,
      type: r.type as RelationType,
      weight: r.weight,
    })),
  }

  // 使用标准 normalizer
  return normalizeLLMResponse(v2Response, rootCanonicalId)
}
