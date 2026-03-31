// QA action types
export type QAActionType = 'save_only' | 'merge_to_field' | 'generate_subtopic' | 'upgrade_to_node'
export type MergeableField = 'principle' | 'useCases' | 'bestPractices' | 'commonMistakes'

export interface KnowledgeQA {
  id: string
  question: string
  answer: string
  action: QAActionType
  actionResult?: string
  mergedField?: MergeableField
  createdAt: Date
}

// Operation status for async operations
export type OperationStatus = 'pending' | 'success' | 'failed'

// Knowledge node type
export interface KnowledgeNode {
  id: string
  title: string
  description: string
  type: 'concept' | 'skill' | 'tool' | 'theory'
  difficulty?: 1 | 2 | 3 | 4 | 5
  estimatedTime?: number
  resources?: string[]
  tags?: string[]
  expanded: boolean
  position?: { x: number; y: number }
  createdAt: Date
  updatedAt: Date
  // Deep knowledge fields (optional)
  principle?: string
  useCases?: string[]
  examples?: Array<{ title: string; code?: string; explanation: string }>
  bestPractices?: string[]
  commonMistakes?: string[]
  keyTerms?: Array<{ term: string; definition: string }>
  subTopics?: Array<{
    title: string
    description: string
    keyPoints?: string[]
  }>
  // Q&A history
  qas?: KnowledgeQA[]

  // Expand operation status (structure: skeleton → dedup → nodes/edges)
  expandStatus?: OperationStatus
  expandError?: string
  activeExpandOpId?: string

  // Deepen operation status (content: deep info + related descriptions)
  deepenStatus?: OperationStatus
  deepenError?: string
  activeDeepenOpId?: string

  /** @deprecated Use expandStatus + deepenStatus instead */
  operationStatus?: OperationStatus
  /** @deprecated Use expandError + deepenError instead */
  operationError?: string
  /** @deprecated Use activeExpandOpId + activeDeepenOpId instead */
  activeOperationId?: string
}

// Relation type
export type RelationType =
  | 'prerequisite' // 前置知识
  | 'postrequisite' // 后置知识
  | 'related' // 相关知识
  | 'contains' // 包含关系
  | 'depends' // 依赖关系

// Knowledge edge type
export interface KnowledgeEdge {
  id: string
  source: string
  target: string
  type: RelationType
  weight?: number
  label?: string
}

// Knowledge graph
export interface KnowledgeGraph {
  id: string
  rootId: string
  nodes: Map<string, KnowledgeNode>
  edges: KnowledgeEdge[]
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
}

// Graph snapshot (for history)
export interface GraphSnapshot {
  id: string
  graphId: string
  timestamp: Date
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
}

// Node expansion state
export interface NodeExpansionState {
  nodeId: string
  expanded: boolean
  childrenIds: string[]
}

// ==================== LLM Response Types (使用 ref 引用) ====================

// LLM 返回的节点（使用 ref 而非 ID）
export interface LLMNodeResponse {
  ref: string           // 引用标识符，如 "root", "n1", "n2"
  title: string
  description: string
  type: 'concept' | 'skill' | 'tool' | 'theory'
  difficulty: 1 | 2 | 3 | 4 | 5
  estimatedTime?: number
  resources?: string[]
  tags?: string[]
}

// LLM 返回的边（使用 ref 引用）
export interface LLMEdgeResponse {
  sourceRef: string     // 源节点 ref
  targetRef: string     // 目标节点 ref
  type: RelationType
  weight?: number
}

// LLM 完整响应结构（新格式）
export interface LLMKnowledgeResponseV2 {
  nodes: LLMNodeResponse[]
  edges: LLMEdgeResponse[]
}

// ==================== Normalized Types (本地 ID) ====================

// Normalizer 的输出
export interface NormalizedKnowledgeResponse {
  rootNode: KnowledgeNode
  relatedNodes: KnowledgeNode[]
  edges: {
    source: string       // 本地 canonical ID
    target: string       // 本地 canonical ID
    type: RelationType
    weight?: number
  }[]
  refMapping: Map<string, string>  // ref -> localId
}

// ==================== Legacy Types (兼容旧格式) ====================

// LLM response structure (旧格式，逐步废弃)
export interface LLMKnowledgeResponse {
  node: KnowledgeNode
  prerequisites: KnowledgeNode[]
  postrequisites: KnowledgeNode[]
  related: KnowledgeNode[]
  relations: {
    from: string
    to: string
    type: RelationType
    weight?: number
  }[]
}

// Convert Map to array for storage
export function nodesToArray(nodes: Map<string, KnowledgeNode>): KnowledgeNode[] {
  return Array.from(nodes.values())
}

// Convert array to Map for runtime
export function arrayToNodes(nodes: KnowledgeNode[]): Map<string, KnowledgeNode> {
  return new Map(nodes.map((node) => [node.id, node]))
}
