import type { RelationType } from '@/types'

/**
 * System prompt for knowledge graph generation
 */
export const SYSTEM_PROMPT = `你是一个专业的知识图谱构建助手。你的任务是根据用户输入的知识点，生成一个结构化的知识图谱。

请遵循以下规则：
1. 返回格式必须是有效的 JSON
2. 每个知识节点应包含：title（标题）、description（描述）、type（类型）、difficulty（1-5的难度等级）
3. 关系应包含：from（源节点标题）、to（目标节点标题）、type（关系类型）
4. 避免生成过多节点，控制在 3-6 个相关节点
5. 确保返回的 JSON 格式正确`

// ==================== 分层 Prompt 设计 ====================

/**
 * Step 1: 主干 Prompt - 快速返回基本信息 + 相关方面列表
 * 目标: ~1s 响应，提供骨架结构
 */
export const KNOWLEDGE_SKELETON_PROMPT = (topic: string) => `请为知识点"${topic}"生成一个快速的知识骨架。

**要求**：快速返回，只包含基本信息和相关知识点的标题列表。

返回 JSON 格式：
{
  "node": {
    "title": "知识点标题",
    "briefDescription": "一句话简介（20字以内）",
    "type": "concept|skill|tool|theory",
    "difficulty": 1-5
  },
  "prerequisites": [
    { "title": "前置知识1", "type": "concept|skill|tool|theory" }
  ],
  "postrequisites": [
    { "title": "后置知识1", "type": "concept|skill|tool|theory" }
  ],
  "related": [
    { "title": "相关知识1", "type": "concept|skill|tool|theory" }
  ]
}

**重要**：
- 只需要标题，不需要详细描述
- 关联节点数量控制在 3-6 个
- 快速响应为主

请为 "${topic}" 生成知识骨架。`

/**
 * Step 2A: 深度 Prompt - 获取主节点的详细信息
 * 目标: 提供原理、用途、示例、实践建议
 */
export const KNOWLEDGE_DEEP_PROMPT = (
  topic: string,
  briefDescription: string,
  relatedNodes?: string[]
) => `请深入讲解知识点"${topic}"。

**简介**：${briefDescription}
${relatedNodes && relatedNodes.length > 0 ? `
**已有的关联知识节点**（以下知识已经作为独立节点存在图中，请勿在 subTopics 中重复）：
${relatedNodes.map((n) => `- ${n}`).join('\n')}
` : ''}
请以 JSON 格式返回以下深度信息，**所有字段都是必填的，不可省略**：
{
  "title": "知识点标题",
  "description": "详细描述（3-5句话，说明这个知识点的核心内容、学习价值）",
  "principle": "原理说明（这个知识点背后的原理、机制或核心思想。至少2句话）",
  "useCases": ["应用场景1", "应用场景2", "应用场景3"],
  "examples": [
    {
      "title": "示例标题",
      "code": "代码示例（技术类主题必填；非技术类可改为"无"）",
      "explanation": "示例解释（说明这个示例展示了什么）"
    }
  ],
  "bestPractices": ["实践建议1", "实践建议2"],
  "commonMistakes": ["常见错误1", "常见错误2"],
  "keyTerms": [
    { "term": "关键术语1", "definition": "简短定义" },
    { "term": "关键术语2", "definition": "简短定义" }
  ],
  "subTopics": [
    { "title": "子话题标题", "description": "简短描述", "keyPoints": ["要点1", "要点2"] }
  ],
  "estimatedTime": 30
}

**字段要求**：
- description: 3-5句话，涵盖核心概念和学习价值
- principle: 至少2句话，说明背后的原理或机制
- useCases: 至少2个具体的应用场景
- examples: 至少1个示例，包含标题和解释；技术类主题需提供 code
- bestPractices: 至少2条可操作的实践建议
- commonMistakes: 至少2个学习者常犯的错误或误区
- keyTerms: 3-5个关键术语，每个包含术语名称和简短定义（一句话）；如不适用可返回空数组
- subTopics: 3-5个子话题，每个包含标题、简短描述和可选要点列表。子话题是当前知识点的**细分方向**（如"React Hooks"的子话题可以是"State Hooks"、"Effect Hooks"），**必须与已有的关联知识节点区分开**，不要把关联节点重复列为子话题。如不适用可返回空数组
- estimatedTime: 预计学习分钟数（整数）

**质量要求**：
- 内容必须具体、实用，避免空泛描述
- 示例要简洁但能说明问题
- 实践建议要有可操作性，不要泛泛而谈

请深入讲解 "${topic}"，返回完整的 JSON。`

/**
 * Step 2B: 关联知识 Prompt - 获取关联节点的简洁描述
 * 目标: 并行请求，快速获取多个关联知识的简介
 */
export const RELATED_KNOWLEDGE_PROMPT = (
  mainTopic: string,
  relatedTitles: string[]
) => `请为以下与"${mainTopic}"相关的知识点提供简洁描述。

**相关知识点列表**：
${relatedTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

请以 JSON 格式返回每个知识点的简介：
{
  "nodes": [
    {
      "title": "知识点标题",
      "description": "简洁描述（1-2句话，说明这是什么）",
      "type": "concept|skill|tool|theory",
      "difficulty": 1-5,
      "relation": "prerequisite|postrequisite|related"
    }
  ]
}

**要求**：
- 每个描述控制在 50 字以内
- 说明与主知识点的关系
- 快速响应

请为以上知识点生成简介。`

// ==================== 保留原有 Prompt（兼容） ====================

/**
 * Prompt template for generating initial knowledge graph (完整版)
 * 使用 ref 引用而非 UUID，前端负责 ref -> localId 转换
 */
export const KNOWLEDGE_GRAPH_PROMPT = (topic: string) => `请为知识点"${topic}"生成一个知识图谱。

**重要**：节点使用简单的引用标识符（ref），不要生成 UUID。

请以 JSON 格式返回以下结构：
{
  "nodes": [
    {
      "ref": "root",
      "title": "主知识点标题",
      "description": "详细描述（2-3句话）",
      "type": "concept|skill|tool|theory",
      "difficulty": 1-5
    },
    {
      "ref": "n1",
      "title": "关联知识标题",
      "description": "描述",
      "type": "concept|skill|tool|theory",
      "difficulty": 1-5
    }
  ],
  "edges": [
    {
      "sourceRef": "n1",
      "targetRef": "root",
      "type": "prerequisite|postrequisite|related|depends",
      "weight": 0.8
    }
  ]
}

**ref 规则**：
- 主知识点固定使用 "root"
- 其他节点按顺序使用 "n1", "n2", "n3" ...

节点类型说明：
- concept: 概念或理论
- skill: 技能或能力
- tool: 工具或框架
- theory: 理论或原理

关系类型说明：
- prerequisite: 前置知识（source 是 target 的前置）
- postrequisite: 后置知识（target 是 source 的后置）
- related: 相关知识
- depends: 依赖关系

请为 "${topic}" 生成知识图谱。`

/**
 * Prompt template for expanding a specific node (分层版)
 */
export const NODE_EXPAND_SKELETON_PROMPT = (
  currentNodeTitle: string,
  currentNodeDescription: string,
  adjacentNodes: string[]
) => `请快速扩展知识节点"${currentNodeTitle}"。

当前节点信息：
- 标题：${currentNodeTitle}
- 描述：${currentNodeDescription}

已有的相邻节点（请避免重复）：
${adjacentNodes.map((n) => `- ${n}`).join('\n')}

**要求**：快速返回骨架，只包含标题。

返回 JSON 格式：
{
  "prerequisites": [
    { "title": "前置知识标题", "type": "concept|skill|tool|theory" }
  ],
  "postrequisites": [
    { "title": "后置知识标题", "type": "concept|skill|tool|theory" }
  ],
  "related": [
    { "title": "相关知识标题", "type": "concept|skill|tool|theory" }
  ]
}

**重要**：
- 只需要标题，不需要详细描述
- 控制在 3-5 个新节点
- 避免与已有节点重复

请快速扩展 "${currentNodeTitle}"。`

/**
 * Prompt template for expanding a specific node (完整版)
 */
export const NODE_EXPAND_PROMPT = (
  currentNodeTitle: string,
  currentNodeDescription: string,
  adjacentNodes: string[]
) => `请扩展知识节点"${currentNodeTitle}"。

当前节点信息：
- 标题：${currentNodeTitle}
- 描述：${currentNodeDescription}

已有的相邻节点（请避免重复）：
${adjacentNodes.map((n) => `- ${n}`).join('\n')}

请返回与该节点相关的新知识节点（不要包含已有的节点），格式同上。
重点关注：尚未列出的前置知识、深入的相关概念、实际应用场景等。

返回格式：
{
  "node": { ... }, // 可以省略或返回当前节点信息
  "prerequisites": [...],
  "postrequisites": [...],
  "related": [...],
  "relations": [...]
}`

/**
 * Prompt for explaining a knowledge node
 */
export const NODE_EXPLAIN_PROMPT = (nodeTitle: string, nodeDescription: string) => `请详细解释以下知识点：

**知识点：** ${nodeTitle}
**描述：** ${nodeDescription}

请提供一个清晰的解释，包括：
1. 这个知识点的核心概念是什么
2. 为什么它很重要
3. 简单的例子或类比帮助理解
4. 常见的应用场景

请用通俗易懂的语言解释。`

/**
 * Get relation type display name in Chinese
 */
export function getRelationTypeName(type: RelationType): string {
  const names: Record<RelationType, string> = {
    prerequisite: '前置知识',
    postrequisite: '后置知识',
    related: '相关知识',
    contains: '包含',
    depends: '依赖',
  }
  return names[type] || type
}

/**
 * Get node type display name in Chinese
 */
export function getNodeTypeName(type: string): string {
  const names: Record<string, string> = {
    concept: '概念',
    skill: '技能',
    tool: '工具',
    theory: '理论',
  }
  return names[type] || type
}
