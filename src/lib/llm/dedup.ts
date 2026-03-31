import type { KnowledgeNode, KnowledgeEdge, RelationType } from '@/types'
import { generateId } from '@/lib/utils'

/**
 * 规范化标题用于比较：NFKC + trim + 合并连续空白 + lowercase
 */
export function canonicalizeTitle(title: string): string {
  return title.trim().normalize('NFKC').replace(/\s+/g, ' ').toLowerCase()
}

export interface DedupSkeletonResult {
  newNodes: KnowledgeNode[]
  newEdges: KnowledgeEdge[]
  nodeTitleMap: Map<string, string>   // canonical title -> nodeId（含新旧节点）
  duplicatesFound: number
}

/**
 * 骨架响应去重
 *
 * @param relatedTitles - LLM 返回的关联知识标题列表
 * @param parentNodeId - 被展开的节点 ID
 * @param existingNodes - 全图节点 Map
 * @param existingEdges - 全图边列表（用于边去重）
 */
export function dedupSkeleton(
  relatedTitles: Array<{ title: string; type: string; relation: string }>,
  parentNodeId: string,
  existingNodes: Map<string, KnowledgeNode>,
  existingEdges: KnowledgeEdge[]
): DedupSkeletonResult {
  const newNodes: KnowledgeNode[] = []
  const newEdges: KnowledgeEdge[] = []
  const nodeTitleMap = new Map<string, string>()
  let duplicatesFound = 0

  // 1. 构建已有节点的 canonical title -> { id, title } 映射
  const existingTitleMap = new Map<string, { id: string; title: string }>()
  existingNodes.forEach((node) => {
    const key = canonicalizeTitle(node.title)
    if (key) existingTitleMap.set(key, { id: node.id, title: node.title })
  })

  // 2. 构建已有边的去重 Set (source->target:type)
  const existingEdgeKeys = new Set<string>()
  existingEdges.forEach((e) => {
    existingEdgeKeys.add(`${e.source}->${e.target}:${e.type}`)
  })

  // 3. 父节点标题（防自环）
  const parentNode = existingNodes.get(parentNodeId)
  const parentCanonical = parentNode ? canonicalizeTitle(parentNode.title) : null

  // 4. 内部去重：skeleton 内相同 canonical title 只保留首次
  const seenInternal = new Set<string>()
  const uniqueTitles = relatedTitles.filter(r => {
    const key = canonicalizeTitle(r.title)
    if (!key || seenInternal.has(key)) return false
    seenInternal.add(key)
    return true
  })

  // 5. 逐项处理
  for (const r of uniqueTitles) {
    const canonicalKey = canonicalizeTitle(r.title)

    // 跳过空标题
    if (!canonicalKey) continue

    // 跳过父节点自身（防自环边）
    if (canonicalKey === parentCanonical) continue

    const existing = existingTitleMap.get(canonicalKey)
    let targetNodeId: string

    if (existing) {
      // 复用已有节点，只创建边
      targetNodeId = existing.id
      duplicatesFound++
    } else {
      // 创建新骨架节点
      targetNodeId = generateId()
      newNodes.push({
        id: targetNodeId,
        title: r.title,
        description: '',
        type: r.type as KnowledgeNode['type'],
        difficulty: 3,
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    nodeTitleMap.set(canonicalKey, targetNodeId)

    // 边去重检查
    const sourceId = r.relation === 'prerequisite' ? targetNodeId : parentNodeId
    const targetId = r.relation === 'prerequisite' ? parentNodeId : targetNodeId
    const edgeKey = `${sourceId}->${targetId}:${r.relation}`

    if (!existingEdgeKeys.has(edgeKey)) {
      existingEdgeKeys.add(edgeKey)
      newEdges.push({
        id: generateId(),
        source: sourceId,
        target: targetId,
        type: r.relation as RelationType,
        weight: 0.7,
      })
    }
  }

  return { newNodes, newEdges, nodeTitleMap, duplicatesFound }
}
