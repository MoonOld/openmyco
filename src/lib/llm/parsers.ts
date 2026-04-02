import type { LLMKnowledgeResponse, LLMKnowledgeResponseV2, KnowledgeNode, RelationType, QAActionType, MergeableField } from '@/types'
import { generateId } from '@/lib/utils'

/**
 * Extract valid JSON from LLM response content.
 *
 * Strategy: direct parse → markdown code fence → bracket-balanced scan (with validation)
 * Supports both `{}` and `[]` top-level structures.
 */
export function extractJSON(content: string): string | null {
  // Step 1: direct parse
  try {
    JSON.parse(content)
    return content
  } catch { /* continue */ }

  // Step 2: strip markdown code fence, then try parse
  const fenceMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (fenceMatch) {
    const fenceContent = fenceMatch[1].trim()
    try {
      JSON.parse(fenceContent)
      return fenceContent
    } catch { /* continue */ }
  }

  // Step 3: bracket-balanced scan with validation
  const text = (fenceMatch ? fenceMatch[1] : content).trim()
  const starts = ['{', '['] as const
  const ends = ['}', ']'] as const

  for (let s = 0; s < text.length; s++) {
    const startIdx = starts.indexOf(text[s] as (typeof starts)[number])
    if (startIdx === -1) continue

    const openCh = starts[startIdx]
    const closeCh = ends[startIdx]
    let depth = 0
    let inString = false
    let escape = false

    for (let i = s; i < text.length; i++) {
      const ch = text[i]
      if (escape) { escape = false; continue }
      if (ch === '\\') { escape = true; continue }
      if (ch === '"') { inString = !inString; continue }
      if (inString) continue
      if (ch === openCh) depth++
      else if (ch === closeCh) {
        depth--
        if (depth === 0) {
          const candidate = text.substring(s, i + 1)
          try {
            JSON.parse(candidate)
            return candidate
          } catch {
            break // candidate failed validation, try next start position
          }
        }
      }
    }
  }

  return null
}

/**
 * Raw LLM response data structure (V2 - 使用 ref)
 */
interface RawLLMNodeDataV2 {
  ref: string
  title: string
  description?: string
  type?: string
  difficulty?: number
  estimatedTime?: number
  resources?: string[]
  tags?: string[]
}

interface RawLLMEdgeDataV2 {
  sourceRef: string
  targetRef: string
  type: string
  weight?: number
}

/**
 * Raw LLM response data structure (Legacy - 使用标题)
 */
interface RawLLMNodeDataLegacy {
  title?: string
  description?: string
  type?: string
  difficulty?: number
  estimatedTime?: number
  resources?: string[]
  tags?: string[]
}

interface RawLLMRelationDataLegacy {
  from: string
  to: string
  type: string
  weight?: number
}

/**
 * 检测响应格式是 V2（nodes + edges）还是 Legacy（node + prerequisites）
 */
function isV2Format(data: Record<string, unknown>): boolean {
  return Array.isArray(data.nodes) && Array.isArray(data.edges)
}

/**
 * Parse LLM response to V2 format (nodes + edges with refs)
 * 返回原始 V2 数据，由 normalizer 处理 ref -> canonicalId 转换
 */
export function parseKnowledgeResponseV2(
  content: string
): LLMKnowledgeResponseV2 | null {
  try {
    const jsonStr = extractJSON(content)
    if (!jsonStr) {
      console.error('[parseV2] No JSON found in response')
      return null
    }

    const data = JSON.parse(jsonStr)
    console.log('[parseV2] Parsed data:', data)

    if (isV2Format(data)) {
      // V2 格式：直接返回
      return {
        nodes: data.nodes.map((n: RawLLMNodeDataV2) => ({
          ref: n.ref,
          title: n.title,
          description: n.description || '',
          type: (n.type || 'concept') as 'concept' | 'skill' | 'tool' | 'theory',
          difficulty: (n.difficulty || 3) as 1 | 2 | 3 | 4 | 5,
          estimatedTime: n.estimatedTime,
          resources: n.resources || [],
          tags: n.tags || [],
        })),
        edges: data.edges.map((e: RawLLMEdgeDataV2) => ({
          sourceRef: e.sourceRef,
          targetRef: e.targetRef,
          type: e.type as RelationType,
          weight: e.weight ?? 0.5,
        })),
      }
    } else {
      // Legacy 格式：转换为 V2
      console.log('[parseV2] Legacy format detected, converting to V2')
      return convertLegacyToV2(data)
    }
  } catch (error) {
    console.error('[parseV2] Failed to parse:', error)
    return null
  }
}

/**
 * 将 Legacy 格式转换为 V2 格式
 */
function convertLegacyToV2(data: Record<string, unknown>): LLMKnowledgeResponseV2 {
  const titleToRef = new Map<string, string>()

  // 主节点
  const nodeData = data.node as RawLLMNodeDataLegacy
  titleToRef.set(nodeData?.title || 'Unknown', 'root')

  // 分配 ref
  let refCounter = 1
  const getRef = (title: string) => {
    if (titleToRef.has(title)) {
      return titleToRef.get(title)!
    }
    const ref = `n${refCounter++}`
    titleToRef.set(title, ref)
    return ref
  }

  // 收集所有节点
  const nodes: LLMKnowledgeResponseV2['nodes'] = []

  // 主节点
  if (nodeData) {
    nodes.push({
      ref: 'root',
      title: nodeData.title || 'Unknown',
      description: nodeData.description || '',
      type: (nodeData.type || 'concept') as 'concept' | 'skill' | 'tool' | 'theory',
      difficulty: (nodeData.difficulty || 3) as 1 | 2 | 3 | 4 | 5,
      estimatedTime: nodeData.estimatedTime,
      resources: nodeData.resources || [],
      tags: nodeData.tags || [],
    })
  }

  // 前置知识
  const prerequisites = (data.prerequisites || []) as RawLLMNodeDataLegacy[]
  prerequisites.forEach((n) => {
    nodes.push({
      ref: getRef(n.title || ''),
      title: n.title || 'Unknown',
      description: n.description || '',
      type: (n.type || 'concept') as 'concept' | 'skill' | 'tool' | 'theory',
      difficulty: (n.difficulty || 3) as 1 | 2 | 3 | 4 | 5,
    })
  })

  // 后置知识
  const postrequisites = (data.postrequisites || []) as RawLLMNodeDataLegacy[]
  postrequisites.forEach((n) => {
    nodes.push({
      ref: getRef(n.title || ''),
      title: n.title || 'Unknown',
      description: n.description || '',
      type: (n.type || 'concept') as 'concept' | 'skill' | 'tool' | 'theory',
      difficulty: (n.difficulty || 3) as 1 | 2 | 3 | 4 | 5,
    })
  })

  // 相关知识
  const related = (data.related || []) as RawLLMNodeDataLegacy[]
  related.forEach((n) => {
    nodes.push({
      ref: getRef(n.title || ''),
      title: n.title || 'Unknown',
      description: n.description || '',
      type: (n.type || 'concept') as 'concept' | 'skill' | 'tool' | 'theory',
      difficulty: (n.difficulty || 3) as 1 | 2 | 3 | 4 | 5,
    })
  })

  // 转换关系
  const relations = (data.relations || []) as RawLLMRelationDataLegacy[]
  const edges: LLMKnowledgeResponseV2['edges'] = relations.map((r) => ({
    sourceRef: titleToRef.get(r.from) || r.from,
    targetRef: titleToRef.get(r.to) || r.to,
    type: r.type as RelationType,
    weight: r.weight ?? 0.5,
  }))

  // 如果没有关系，自动生成
  if (edges.length === 0) {
    const rootRef = 'root'
    prerequisites.forEach((n) => {
      edges.push({
        sourceRef: titleToRef.get(n.title || '') || '',
        targetRef: rootRef,
        type: 'prerequisite',
        weight: 0.8,
      })
    })
    postrequisites.forEach((n) => {
      edges.push({
        sourceRef: rootRef,
        targetRef: titleToRef.get(n.title || '') || '',
        type: 'postrequisite',
        weight: 0.8,
      })
    })
    related.forEach((n) => {
      edges.push({
        sourceRef: rootRef,
        targetRef: titleToRef.get(n.title || '') || '',
        type: 'related',
        weight: 0.6,
      })
    })
  }

  return { nodes, edges }
}

// ==================== Legacy Parser（兼容旧代码） ====================

/**
 * @deprecated 使用 parseKnowledgeResponseV2 + normalizer 替代
 */
export function parseKnowledgeResponse(
  content: string,
  rootNodeId?: string
): LLMKnowledgeResponse | null {
  try {
    const jsonStr = extractJSON(content)
    if (!jsonStr) {
      console.error('No JSON found in response')
      return null
    }

    const data = JSON.parse(jsonStr)
    console.log('[parseKnowledgeResponse] Parsed data:', data)

    // Parse main node
    const node = parseNode(data.node, rootNodeId)
    console.log('[parseKnowledgeResponse] Parsed node:', node)

    // Parse related nodes
    const prerequisites = (data.prerequisites || []).map((n: RawLLMNodeDataLegacy) =>
      parseNode(n)
    )
    const postrequisites = (data.postrequisites || []).map((n: RawLLMNodeDataLegacy) =>
      parseNode(n)
    )
    const related = (data.related || []).map((n: RawLLMNodeDataLegacy) => parseNode(n))

    console.log('[parseKnowledgeResponse] Prerequisites:', prerequisites.map((n: KnowledgeNode) => n.title))
    console.log('[parseKnowledgeResponse] Postrequisites:', postrequisites.map((n: KnowledgeNode) => n.title))
    console.log('[parseKnowledgeResponse] Related:', related.map((n: KnowledgeNode) => n.title))

    // Parse relations
    const relations = (data.relations || []).map((r: RawLLMRelationDataLegacy) => ({
      from: r.from,
      to: r.to,
      type: r.type as RelationType,
      weight: r.weight ?? 0.5,
    }))

    console.log('[parseKnowledgeResponse] Relations:', relations)

    return {
      node,
      prerequisites,
      postrequisites,
      related,
      relations,
    }
  } catch (error) {
    console.error('Failed to parse knowledge response:', error)
    return null
  }
}

/**
 * Parse a single node from LLM response (Legacy)
 */
function parseNode(data: RawLLMNodeDataLegacy, id?: string): KnowledgeNode {
  const now = new Date()
  return {
    id: id || generateId(),
    title: data.title || 'Unknown',
    description: data.description || '',
    type: (data.type || 'concept') as KnowledgeNode['type'],
    difficulty: (data.difficulty || 3) as KnowledgeNode['difficulty'],
    estimatedTime: data.estimatedTime,
    resources: data.resources || [],
    tags: data.tags || [],
    expanded: false,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Build title to ID mapping for relation linking
 */
export function buildTitleToIdMap(
  rootNode: KnowledgeNode,
  response: LLMKnowledgeResponse
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

/**
 * Convert relation titles to IDs
 */
export function convertRelationsToIds(
  relations: LLMKnowledgeResponse['relations'],
  titleToId: Map<string, string>
): Array<{ from: string; to: string; type: RelationType; weight?: number }> {
  return relations
    .map((rel) => {
      const fromId = titleToId.get(rel.from)
      const toId = titleToId.get(rel.to)

      if (!fromId || !toId) {
        console.warn(`Cannot find IDs for relation: ${rel.from} -> ${rel.to}`)
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

/**
 * Validate LLM response structure
 */
export function validateKnowledgeResponse(
  data: unknown
): data is LLMKnowledgeResponse {
  if (!data || typeof data !== 'object') return false

  const obj = data as Record<string, unknown>
  if (!obj.node || typeof obj.node !== 'object') return false

  const hasValidArrays =
    Array.isArray(obj.prerequisites) &&
    Array.isArray(obj.postrequisites) &&
    Array.isArray(obj.related) &&
    Array.isArray(obj.relations)

  return hasValidArrays
}

/**
 * Extract error message from LLM response
 */
export function extractErrorMessage(content: string): string | null {
  const errorPatterns = [
    /error[:\s]*(.+)/i,
    /sorry[:\s]*(.+)/i,
    /无法(.+)/,
    /抱歉(.+)/,
  ]

  for (const pattern of errorPatterns) {
    const match = content.match(pattern)
    if (match) {
      return match[1].trim()
    }
  }

  return null
}

// ==================== 分层解析函数 ====================

/**
 * Parse skeleton response (Step 1 - fast response)
 */
export function parseSkeletonResponse(content: string): {
  node: { title: string; briefDescription: string; type: string; difficulty: number }
  relatedTitles: { title: string; type: string; relation: string }[]
  subTopics?: Array<{ title: string }>
} | null {
  try {
    const jsonStr = extractJSON(content)
    if (!jsonStr) return null

    const data = JSON.parse(jsonStr)

    // Parse subTopics with defensive validation
    let subTopics: Array<{ title: string }> | undefined
    if (Array.isArray(data.subTopics)) {
      const filtered = (data.subTopics as unknown[])
        .filter((st: unknown): st is { title: string } =>
          typeof st === 'object' && st !== null
          && typeof (st as Record<string, unknown>).title === 'string'
          && ((st as Record<string, unknown>).title as string).trim() !== ''
        )
        .map((st) => ({ title: (st.title as string).trim() }))
      if (filtered.length > 0) {
        subTopics = filtered
      }
    }

    return {
      node: {
        title: data.node?.title || 'Unknown',
        briefDescription: data.node?.briefDescription || '',
        type: data.node?.type || 'concept',
        difficulty: data.node?.difficulty || 3,
      },
      relatedTitles: [
        ...(data.prerequisites || []).map((n: { title: string; type: string }) => ({
          title: n.title,
          type: n.type || 'concept',
          relation: 'prerequisite',
        })),
        ...(data.postrequisites || []).map((n: { title: string; type: string }) => ({
          title: n.title,
          type: n.type || 'concept',
          relation: 'postrequisite',
        })),
        ...(data.related || []).map((n: { title: string; type: string }) => ({
          title: n.title,
          type: n.type || 'concept',
          relation: 'related',
        })),
      ],
      subTopics,
    }
  } catch (error) {
    console.error('Failed to parse skeleton response:', error)
    return null
  }
}

/**
 * Parse deep response (Step 2A - detailed info)
 */
export function parseDeepResponse(content: string, subTopicTitles?: string[]): {
  title: string
  description: string
  principle?: string
  useCases?: string[]
  examples?: Array<{ title: string; code?: string; explanation: string }>
  bestPractices?: string[]
  commonMistakes?: string[]
  keyTerms?: Array<{ term: string; definition: string }>
  subTopics?: Array<{ title: string; description: string; keyPoints?: string[] }>
  analogies?: Array<{ analogy: string; mapsTo: string; limitation?: string }>
  estimatedTime?: number
} | null {
  try {
    const jsonStr = extractJSON(content)
    if (!jsonStr) return null

    const data = JSON.parse(jsonStr)

    // Parse keyTerms with defensive validation
    let keyTerms: Array<{ term: string; definition: string }> | undefined
    if (Array.isArray(data.keyTerms)) {
      const filtered = (data.keyTerms as unknown[])
        .filter((kt: unknown): kt is { term: string; definition: string } =>
          typeof kt === 'object' && kt !== null
          && typeof (kt as Record<string, unknown>).term === 'string'
          && typeof (kt as Record<string, unknown>).definition === 'string'
          && ((kt as Record<string, unknown>).term as string).trim() !== ''
          && ((kt as Record<string, unknown>).definition as string).trim() !== ''
        )
        .map((kt) => ({
          term: kt.term.trim(),
          definition: kt.definition.trim(),
        }))
      if (filtered.length > 0) {
        keyTerms = filtered
      }
    }

    // Parse subTopics with defensive validation
    let subTopics: Array<{ title: string; description: string; keyPoints?: string[] }> | undefined
    if (Array.isArray(data.subTopics)) {
      const filtered = (data.subTopics as unknown[])
        .filter((st: unknown): st is { title: string; description: string; keyPoints?: unknown[] } =>
          typeof st === 'object' && st !== null
          && typeof (st as Record<string, unknown>).title === 'string'
          && typeof (st as Record<string, unknown>).description === 'string'
          && ((st as Record<string, unknown>).title as string).trim() !== ''
          && ((st as Record<string, unknown>).description as string).trim() !== ''
        )
        .map((st) => {
          const parsed: { title: string; description: string; keyPoints?: string[] } = {
            title: st.title.trim(),
            description: st.description.trim(),
          }
          if (Array.isArray(st.keyPoints)) {
            const validPoints = st.keyPoints
              .filter((kp: unknown): kp is string => typeof kp === 'string' && kp.trim() !== '')
              .map((kp) => kp.trim())
            if (validPoints.length > 0) {
              parsed.keyPoints = validPoints
            }
          }
          return parsed
        })
      if (filtered.length > 0) {
        if (subTopicTitles && subTopicTitles.length > 0) {
          const allowedSet = new Set(subTopicTitles.map((t) => t.trim().toLowerCase()))
          const whitelisted = filtered.filter((st) =>
            allowedSet.has(st.title.trim().toLowerCase())
          )
          if (whitelisted.length > 0) {
            subTopics = whitelisted
          }
        } else {
          subTopics = filtered
        }
      }
    }

    // Parse analogies with defensive validation
    let analogies: Array<{ analogy: string; mapsTo: string; limitation?: string }> | undefined
    if (Array.isArray(data.analogies)) {
      const filtered = (data.analogies as unknown[])
        .filter((a: unknown): a is { analogy: string; mapsTo: string; limitation?: string } =>
          typeof a === 'object' && a !== null
          && typeof (a as Record<string, unknown>).analogy === 'string'
          && typeof (a as Record<string, unknown>).mapsTo === 'string'
          && ((a as Record<string, unknown>).analogy as string).trim() !== ''
          && ((a as Record<string, unknown>).mapsTo as string).trim() !== ''
        )
        .map((a) => {
          const parsed: { analogy: string; mapsTo: string; limitation?: string } = {
            analogy: a.analogy.trim(),
            mapsTo: a.mapsTo.trim(),
          }
          if (typeof a.limitation === 'string' && a.limitation.trim() !== '') {
            parsed.limitation = a.limitation.trim()
          }
          return parsed
        })
      if (filtered.length > 0) {
        analogies = filtered
      }
    }

    return {
      title: data.title,
      description: data.description,
      principle: data.principle,
      useCases: data.useCases,
      examples: data.examples,
      bestPractices: data.bestPractices,
      commonMistakes: data.commonMistakes,
      keyTerms,
      subTopics,
      analogies,
      estimatedTime: data.estimatedTime,
    }
  } catch (error) {
    console.error('Failed to parse deep response:', error)
    return null
  }
}

// ==================== QA Response Parser ====================

const VALID_QA_ACTIONS: QAActionType[] = ['save_only', 'merge_to_field', 'generate_subtopic', 'upgrade_to_node']
const VALID_MERGE_FIELDS: MergeableField[] = ['principle', 'useCases', 'bestPractices', 'commonMistakes']

export interface QAResponse {
  answer: string
  suggestedAction: QAActionType
  suggestedField?: MergeableField
}

/**
 * Parse QA response from LLM
 */
export function parseQAResponse(content: string): QAResponse | null {
  try {
    const jsonStr = extractJSON(content)
    if (!jsonStr) return null

    const data = JSON.parse(jsonStr)

    // Validate answer
    if (!data.answer || typeof data.answer !== 'string' || data.answer.trim() === '') {
      return null
    }

    // Validate suggestedAction (fallback to save_only)
    let suggestedAction: QAActionType = 'save_only'
    if (data.suggestedAction && VALID_QA_ACTIONS.includes(data.suggestedAction)) {
      suggestedAction = data.suggestedAction
    }

    // Validate suggestedField (only for merge_to_field)
    let suggestedField: MergeableField | undefined
    if (suggestedAction === 'merge_to_field' && data.suggestedField) {
      if (VALID_MERGE_FIELDS.includes(data.suggestedField)) {
        suggestedField = data.suggestedField
      }
    }

    return {
      answer: data.answer.trim(),
      suggestedAction,
      suggestedField,
    }
  } catch {
    return null
  }
}
