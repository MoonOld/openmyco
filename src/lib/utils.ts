import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { KnowledgeNode, RelationType } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function arrayToNodes(nodes: KnowledgeNode[]): Map<string, KnowledgeNode> {
  return new Map(nodes.map((node) => [node.id, node]))
}

export function buildTitleToIdMap(
  rootNode: KnowledgeNode,
  response: { node: KnowledgeNode; prerequisites: KnowledgeNode[]; postrequisites: KnowledgeNode[]; related: KnowledgeNode[] }
): Map<string, string> {
  const map = new Map<string, string>()

  // Add root node
  map.set(rootNode.title, rootNode.id)

  // Add related nodes
  response.prerequisites.forEach((n) => map.set(n.title, n.id))
  response.postrequisites.forEach((n) => map.set(n.title, n.id))
  response.related.forEach((n) => map.set(n.title, n.id))

  return map
}

export function convertRelationsToIds(
  relations: Array<{ from: string; to: string; type: RelationType; weight?: number }>,
  titleToId: Map<string, string>
): Array<{ from: string; to: string; type: RelationType; weight?: number }> {
  console.log('[convertRelationsToIds] Input relations:', relations)
  console.log('[convertRelationsToIds] Title to ID map:', Object.fromEntries(titleToId))

  // 检测 ID 格式的正则（看起来像 generateId() 生成的）
  const idPattern = /^[a-z0-9]{6,20}$/i

  return relations
    .map((rel) => {
      // 跳过看起来像 ID 的值（LLM 可能误解返回了 ID）
      if (idPattern.test(rel.from) || idPattern.test(rel.to)) {
        console.warn(`[convertRelationsToIds] Skipping relation with ID-like values: "${rel.from}" -> "${rel.to}"`)
        return null
      }

      const fromId = titleToId.get(rel.from)
      const toId = titleToId.get(rel.to)

      if (!fromId || !toId) {
        console.warn(`[convertRelationsToIds] Cannot find IDs for relation: "${rel.from}" -> "${rel.to}"`)
        console.warn(`[convertRelationsToIds]   fromId: ${fromId}, toId: ${toId}`)
        return null
      }

      return {
        from: fromId,
        to: toId,
        type: rel.type,
        weight: rel.weight,
      }
    })
    .filter((rel): rel is NonNullable<typeof rel> => rel !== null)
}
