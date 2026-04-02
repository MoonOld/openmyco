import type {
  LLMConfig,
  ChatMessage,
  OpenAIChatResponse,
  LLMKnowledgeResponse,
  LLMKnowledgeResponseV2,
} from '@/types'
import { parseKnowledgeResponse, parseKnowledgeResponseV2, parseSkeletonResponse, parseDeepResponse, parseQAResponse, parseAdvancedResponse, extractJSON } from './parsers'
import type { QAResponse, AdvancedResponse } from './parsers'
import {
  KNOWLEDGE_GRAPH_PROMPT,
  KNOWLEDGE_SKELETON_PROMPT as KNOWLEDGE_SKELETON_PROMPT_FN,
  KNOWLEDGE_DEEP_PROMPT,
  RELATED_KNOWLEDGE_PROMPT,
  NODE_EXPAND_PROMPT,
  NODE_EXPAND_SKELETON_PROMPT,
  NODE_EXPLAIN_PROMPT,
  QA_PROMPT,
  ADVANCED_PROMPT,
} from './prompts'
import pLimit from 'p-limit'

// Aliases for clarity
const KNOWLEDGE_SKELETON_PROMPT = KNOWLEDGE_SKELETON_PROMPT_FN
import { generateId } from '@/lib/utils'

// 支持的 API 端点列表，按优先级排序
const POSSIBLE_ENDPOINTS = ['chat/completions', 'chat/responses'] as const
type Endpoint = typeof POSSIBLE_ENDPOINTS[number]

// 端点缓存 key（按 baseURL + model 分组）
const getEndpointCacheKey = (baseURL: string, model: string) =>
  `llm_endpoint:${baseURL}:${model}`

/**
 * LLM Client for OpenAI Compatible API
 * 支持自动探测和 fallback 到不同的 API 端点
 */
export class LLMClient {
  private config: LLMConfig
  private workingEndpoint: Endpoint | null = null
  // 并发限制器
  private limit: ReturnType<typeof pLimit>
  // 记录端点探测时的最后一个错误（用于 testConnection 返回详细错误）
  private lastDetectionError:    | {
        type: 'http'
        status: number
        statusText: string
        body: string
      }
    | {
        type: 'network'
        message: string
      }
    | null = null

  constructor(config: LLMConfig) {
    this.config = config
    // 初始化并发限制器，默认 5 个并发
    const concurrency = Math.max(1, Math.min(10, config.maxConcurrency ?? 5))
    this.limit = pLimit(concurrency)
    // 如果用户指定了端点，优先使用
    if (config.endpoint && POSSIBLE_ENDPOINTS.includes(config.endpoint as Endpoint)) {
      this.workingEndpoint = config.endpoint as Endpoint
    } else {
      // 尝试从 localStorage 恢复缓存的端点
      const cached = localStorage.getItem(getEndpointCacheKey(config.baseURL, config.model))
      if (cached && POSSIBLE_ENDPOINTS.includes(cached as Endpoint)) {
        this.workingEndpoint = cached as Endpoint
      }
    }
  }

  /**
   * 探测可用的 API 端点
   * 返回第一个成功响应的端点
   */
  private async detectEndpoint(): Promise<Endpoint | null> {
    // 如果已经有工作的端点，直接返回
    if (this.workingEndpoint) {
      return this.workingEndpoint
    }

    // 如果用户指定了端点，优先尝试
    if (this.config.endpoint) {
      const endpoint = this.config.endpoint as Endpoint
      if (await this.tryEndpoint(endpoint)) {
        this.workingEndpoint = endpoint
        console.log(`[LLM] 使用指定端点: /${endpoint}`)
        return endpoint
      }
      console.warn(`[LLM] 指定端点 /${endpoint} 不可用，尝试其他端点...`)
    }

    // 自动探测各个端点
    for (const endpoint of POSSIBLE_ENDPOINTS) {
      if (await this.tryEndpoint(endpoint)) {
        this.workingEndpoint = endpoint
        // 缓存探测结果到 localStorage
        localStorage.setItem(
          getEndpointCacheKey(this.config.baseURL, this.config.model),
          endpoint
        )
        console.log(`[LLM] 自动探测到可用端点: /${endpoint}`)
        return endpoint
      }
    }

    console.error('[LLM] 无法找到可用的 API 端点')
    return null
  }

  /**
   * 尝试使用指定端点发送简单请求测试
   */
  private async tryEndpoint(endpoint: Endpoint): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseURL}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
        }),
      })

      if (response.ok) {
        const text = await response.text()
        // 检查返回的是有效 JSON
        return text.trim().startsWith('{')
      }

      // 记录 HTTP 错误信息（用于 testConnection 返回详细错误）
      const body = await response.text()
      this.lastDetectionError = {
        type: 'http',
        status: response.status,
        statusText: response.statusText,
        body,
      }

      return false
    } catch (error) {
      // 记录网络错误（包括 CORS 错误）
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.lastDetectionError = {
        type: 'network',
        message: errorMessage,
      }
      return false
    }
  }

  /**
   * 获取当前工作的端点，如果尚未探测则自动探测
   */
  private async getEndpoint(): Promise<string> {
    const endpoint = await this.detectEndpoint()
    if (!endpoint) {
      // 如果探测失败，使用默认端点尝试
      return 'chat/completions'
    }
    return endpoint
  }

  /**
   * Generate a knowledge graph for a given topic (V2 - 使用 ref)
   * 返回原始 V2 格式，由 normalizer 处理 ref -> localId 转换
   */
  async generateKnowledgeGraphV2(topic: string): Promise<LLMKnowledgeResponseV2 | null> {
    const messages: ChatMessage[] = [
      { role: 'system', content: '你是一个专业的知识图谱构建助手。请始终返回有效的 JSON 格式。' },
      { role: 'user', content: KNOWLEDGE_GRAPH_PROMPT(topic) },
    ]

    const response = await this.chat(messages)

    if (!response) {
      return null
    }

    return parseKnowledgeResponseV2(response)
  }

  /**
   * @deprecated 使用 generateKnowledgeGraphV2 + normalizer 替代
   */
  async generateKnowledgeGraph(topic: string): Promise<LLMKnowledgeResponse | null> {
    const messages: ChatMessage[] = [
      { role: 'system', content: '你是一个专业的知识图谱构建助手。请始终返回有效的 JSON 格式。' },
      { role: 'user', content: KNOWLEDGE_GRAPH_PROMPT(topic) },
    ]

    const response = await this.chat(messages)

    if (!response) {
      return null
    }

    const rootNodeId = generateId()
    return parseKnowledgeResponse(response, rootNodeId)
  }

  // ==================== 分层获取方法 ====================

  /**
   * Step 1: 获取知识骨架（快速响应）
   * 返回基本信息 + 相关知识标题列表
   */
  async getKnowledgeSkeleton(topic: string): Promise<{
    node: { title: string; briefDescription: string; type: string; difficulty: number }
    relatedTitles: { title: string; type: string; relation: string }[]
    subTopics?: Array<{ title: string }>
  } | null> {
    const messages: ChatMessage[] = [
      { role: 'system', content: '你是一个知识图谱助手。快速返回 JSON 格式的知识骨架。' },
      { role: 'user', content: KNOWLEDGE_SKELETON_PROMPT(topic) },
    ]

    const response = await this.chat(messages)
    if (!response) return null

    return parseSkeletonResponse(response)
  }

  /**
   * Step 2A: 获取知识深度信息（详细）
   */
  async getKnowledgeDeep(topic: string, briefDescription: string, relatedNodes?: string[], subTopicTitles?: string[]): Promise<{
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
  } | null> {
    const messages: ChatMessage[] = [
      { role: 'system', content: '你是一个知识讲解专家。返回详细的 JSON 格式知识内容。' },
      { role: 'user', content: KNOWLEDGE_DEEP_PROMPT(topic, briefDescription, relatedNodes, subTopicTitles) },
    ]

    const response = await this.chat(messages)
    if (!response) return null

    return parseDeepResponse(response, subTopicTitles)
  }

  /**
   * Step 2B: 获取关联知识描述（并行）
   */
  async getRelatedKnowledge(
    mainTopic: string,
    relatedTitles: string[]
  ): Promise<Array<{
    title: string
    description: string
    type: string
    difficulty: number
    relation: string
  }> | null> {
    if (relatedTitles.length === 0) return []

    const messages: ChatMessage[] = [
      { role: 'system', content: '你是一个知识图谱助手。为多个知识点返回简洁描述。' },
      { role: 'user', content: RELATED_KNOWLEDGE_PROMPT(mainTopic, relatedTitles) },
    ]

    const response = await this.chat(messages)
    if (!response) return null

    try {
      const jsonStr = extractJSON(response)
      if (!jsonStr) return null

      const data = JSON.parse(jsonStr)
      return data.nodes || null
    } catch {
      return null
    }
  }

  /**
   * 分层获取完整知识（骨架 + 深度 + 关联）
   * Step 1: 快速获取骨架 → 立即返回
   * Step 2: 并行获取深度信息和关联描述
   */
  async getKnowledgeLayered(topic: string, onSkeleton?: (skeleton: {
    node: { title: string; briefDescription: string; type: string; difficulty: number }
    relatedTitles: { title: string; type: string; relation: string }[]
    subTopics?: Array<{ title: string }>
  }) => void): Promise<LLMKnowledgeResponse | null> {
    // Step 1: 获取骨架
    const skeleton = await this.getKnowledgeSkeleton(topic)
    if (!skeleton) return null

    // 立即回调，让 UI 先显示骨架
    onSkeleton?.(skeleton)

    // Step 2: 并行获取深度信息和关联描述
    const relatedTitles = skeleton.relatedTitles.map(r => r.title)
    const subTopicTitles = skeleton.subTopics?.map(st => st.title)

    const [deepInfo, relatedInfo] = await Promise.all([
      // 线程 A: 获取深度信息
      this.getKnowledgeDeep(skeleton.node.title, skeleton.node.briefDescription, undefined, subTopicTitles),
      // 线程 B: 获取关联知识描述
      this.getRelatedKnowledge(skeleton.node.title, relatedTitles),
    ])

    // 合并结果
    const rootNodeId = generateId()
    const nodes: LLMKnowledgeResponse = {
      node: {
        id: rootNodeId,
        title: deepInfo?.title || skeleton.node.title,
        description: deepInfo?.description || skeleton.node.briefDescription,
        type: skeleton.node.type as 'concept' | 'skill' | 'tool' | 'theory',
        difficulty: skeleton.node.difficulty as 1 | 2 | 3 | 4 | 5,
        estimatedTime: deepInfo?.estimatedTime,
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        // 附加深度信息
        principle: deepInfo?.principle,
        useCases: deepInfo?.useCases,
        examples: deepInfo?.examples,
        bestPractices: deepInfo?.bestPractices,
        commonMistakes: deepInfo?.commonMistakes,
        keyTerms: deepInfo?.keyTerms,
        subTopics: deepInfo?.subTopics,
      },
      prerequisites: [],
      postrequisites: [],
      related: [],
      relations: [],
    }

    // 添加关联节点
    if (relatedInfo) {
      relatedInfo.forEach((info) => {
        const nodeId = generateId()
        const node = {
          id: nodeId,
          title: info.title,
          description: info.description,
          type: info.type as 'concept' | 'skill' | 'tool' | 'theory',
          difficulty: info.difficulty as 1 | 2 | 3 | 4 | 5,
          expanded: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        if (info.relation === 'prerequisite') {
          nodes.prerequisites.push(node)
          nodes.relations.push({
            from: info.title,
            to: skeleton.node.title,
            type: 'prerequisite',
            weight: 0.8,
          })
        } else if (info.relation === 'postrequisite') {
          nodes.postrequisites.push(node)
          nodes.relations.push({
            from: skeleton.node.title,
            to: info.title,
            type: 'postrequisite',
            weight: 0.8,
          })
        } else {
          nodes.related.push(node)
          nodes.relations.push({
            from: skeleton.node.title,
            to: info.title,
            type: 'related',
            weight: 0.6,
          })
        }
      })
    }

    return nodes
  }

  /**
   * Expand a specific node with more related knowledge
   */
  async expandNode(
    nodeTitle: string,
    nodeDescription: string,
    adjacentNodes: string[]
  ): Promise<LLMKnowledgeResponse | null> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: '你是一个专业的知识图谱构建助手。请始终返回有效的 JSON 格式。',
      },
      {
        role: 'user',
        content: NODE_EXPAND_PROMPT(nodeTitle, nodeDescription, adjacentNodes),
      },
    ]

    const response = await this.chat(messages)

    if (!response) {
      return null
    }

    return parseKnowledgeResponse(response)
  }

  /**
   * Layer 2: Get advanced deepening content (reflection prompts + challenge)
   */
  async getAdvancedDeep(
    topic: string,
    description: string,
    principle?: string
  ): Promise<AdvancedResponse | null> {
    const messages: ChatMessage[] = [
      { role: 'system', content: '你是一个教育设计专家。请始终返回有效的 JSON 格式。' },
      { role: 'user', content: ADVANCED_PROMPT(topic, description, principle) },
    ]

    const response = await this.chat(messages)
    if (!response) return null

    return parseAdvancedResponse(response)
  }

  /**
   * Get explanation for a node
   */

  /**
   * 展开节点获取骨架（使用专用 expand prompt，传入已有节点标题减少重复）
   */
  async expandSkeleton(
    nodeTitle: string,
    nodeDescription: string,
    adjacentNodes: string[],
    existingNodeTitles?: string[]
  ): Promise<{
    node: { title: string; briefDescription: string; type: string; difficulty: number }
    relatedTitles: { title: string; type: string; relation: string }[]
    subTopics?: Array<{ title: string }>
  } | null> {
    const messages: ChatMessage[] = [
      { role: 'system', content: '你是一个知识图谱助手。快速返回 JSON 格式的知识骨架。' },
      { role: 'user', content: NODE_EXPAND_SKELETON_PROMPT(nodeTitle, nodeDescription, adjacentNodes, existingNodeTitles) },
    ]

    const response = await this.chat(messages)
    if (!response) return null

    return parseSkeletonResponse(response)
  }
  async explainNode(nodeTitle: string, nodeDescription: string): Promise<string | null> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: '你是一个知识解释助手，用通俗易懂的语言解释复杂概念。',
      },
      {
        role: 'user',
        content: NODE_EXPLAIN_PROMPT(nodeTitle, nodeDescription),
      },
    ]

    return await this.chat(messages)
  }

  /**
   * Ask a question about a knowledge node
   */
  async askQuestion(
    nodeTitle: string,
    nodeDescription: string,
    question: string,
    qaHistory?: Array<{ question: string; answer: string }>,
    principleSummary?: string
  ): Promise<QAResponse | null> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: '你是一个知识学习助手。请返回有效的 JSON 格式。',
      },
      {
        role: 'user',
        content: QA_PROMPT(nodeTitle, nodeDescription, question, qaHistory, principleSummary),
      },
    ]

    const response = await this.chat(messages)
    if (!response) return null

    return parseQAResponse(response)
  }

  /**
   * Send a chat request to the LLM API
   * 支持自动 fallback 到不同的端点
   * 支持并发限制
   */
  async chat(messages: ChatMessage[]): Promise<string | null> {
    return this.limit(() => this.doChat(messages))
  }

  /**
   * 实际执行 chat 请求（内部方法）
   */
  private async doChat(messages: ChatMessage[]): Promise<string | null> {
    const endpoint = await this.getEndpoint()

    try {
      const requestBody: Record<string, unknown> = {
        model: this.config.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }

      if (this.config.temperature !== undefined) {
        requestBody.temperature = this.config.temperature
      }
      if (this.config.maxTokens !== undefined) {
        requestBody.max_tokens = this.config.maxTokens
      }

      const response = await fetch(`${this.config.baseURL}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[LLM] API error (endpoint: /${endpoint}):`, response.status, errorText)

        // 如果是 404 错误且没有探测过其他端点，尝试 fallback
        if (response.status === 404 && this.config.endpoint === endpoint) {
          console.warn('[LLM] 端点返回 404，尝试 fallback 到其他端点...')
          this.workingEndpoint = null // 重置缓存
          const fallbackEndpoint = await this.detectEndpoint()
          if (fallbackEndpoint && fallbackEndpoint !== endpoint) {
            console.log(`[LLM] Fallback 到 /${fallbackEndpoint}`)
            // 递归尝试新端点
            return this.chat(messages)
          }
        }

        throw new Error(`API error: ${response.status} - ${errorText}`)
      }

      const data: OpenAIChatResponse = await response.json()
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        console.error('Empty response from LLM')
        return null
      }

      return content
    } catch (error) {
      console.error('[LLM] Request failed:', error)
      throw error
    }
  }

  /**
   * Stream a chat request
   * 支持自动 fallback 到不同的端点
   */
  async *chatStream(messages: ChatMessage[]): AsyncGenerator<string, void, unknown> {
    const endpoint = await this.getEndpoint()

    try {
      const requestBody: Record<string, unknown> = {
        model: this.config.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
      }

      if (this.config.temperature !== undefined) {
        requestBody.temperature = this.config.temperature
      }
      if (this.config.maxTokens !== undefined) {
        requestBody.max_tokens = this.config.maxTokens
      }

      const response = await fetch(`${this.config.baseURL}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices[0]?.delta?.content
              if (content) {
                yield content
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('[LLM] Stream request failed:', error)
      throw error
    }
  }

  /**
   * Test if the API connection is working
   * 支持端点自动探测
   */
  async testConnection(): Promise<
    | { success: true; model: string; responseTime: number; endpoint: string; content?: string }
    | { success: false; error: string; httpStatus?: number; httpStatusText?: string; responseBody?: string; isCors?: boolean }
  > {
    const startTime = Date.now()

    try {
      console.log('[LLM] Testing connection to:', this.config.baseURL)
      console.log('[LLM] Model:', this.config.model)

      // 重置端点缓存以进行测试
      this.workingEndpoint = null
      const endpoint = await this.detectEndpoint()

      if (!endpoint) {
        // 如果探测时有错误，返回详细的错误信息
        const detectionError = this.lastDetectionError
        if (detectionError) {
          // 处理网络错误（包括 CORS）
          if (detectionError.type === 'network') {
            const errorMessage = detectionError.message
            const isCors = errorMessage.includes('Failed to fetch') ||
              errorMessage.includes('NetworkError') ||
              errorMessage.includes('CORS')

            if (isCors) {
              return {
                success: false,
                error: 'CORS 跨域错误\n\n建议：\n• 使用 Electron 桌面版\n• 使用支持跨域的 API\n• 或配置代理服务器',
                isCors: true,
              }
            }

            return {
              success: false,
              error: errorMessage,
            }
          }

          // 处理 HTTP 错误
          if (detectionError.type === 'http') {
            const hints: Record<number, string> = {
              400: '请求格式错误，可能是模型名称不正确',
              401: 'API Key 无效或未提供',
              403: 'API Key 没有权限，或账户余额不足/配额用完',
              404: 'API 端点不存在，请检查 Base URL',
              429: '请求频率超限，请稍后重试',
              500: '服务器内部错误，请稍后重试',
              503: '服务暂时不可用',
            }
            const hint = hints[detectionError.status]
            const hintText = hint ? `\n💡 ${hint}` : ''

            return {
              success: false,
              error: `HTTP ${detectionError.status} ${detectionError.statusText}${hintText}`,
              httpStatus: detectionError.status,
              httpStatusText: detectionError.statusText,
              responseBody: detectionError.body,
            }
          }
        }

        return {
          success: false,
          error: '无法找到可用的 API 端点。已尝试: ' + POSSIBLE_ENDPOINTS.join(', '),
        }
      }

      const response = await fetch(`${this.config.baseURL}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 10,
        }),
      })

      const responseTime = Date.now() - startTime
      console.log('[LLM] Response status:', response.status, response.statusText)
      console.log('[LLM] Working endpoint: /' + endpoint)

      if (!response.ok) {
        const responseBody = await response.text()
        console.log('[LLM] Error response body:', responseBody)

        // Build helpful error message based on status code
        const hints: Record<number, string> = {
          400: '请求格式错误，可能是模型名称不正确',
          401: 'API Key 无效或未提供',
          403: 'API Key 没有权限，或账户余额不足/配额用完',
          404: 'API 端点不存在，请检查 Base URL',
          429: '请求频率超限，请稍后重试',
          500: '服务器内部错误，请稍后重试',
          503: '服务暂时不可用',
        }

        const hint = hints[response.status]
        const hintText = hint ? `\n💡 ${hint}` : ''

        return {
          success: false,
          error: `HTTP ${response.status} ${response.statusText}${hintText}`,
          httpStatus: response.status,
          httpStatusText: response.statusText,
          responseBody,
        }
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content

      return {
        success: true,
        model: this.config.model,
        endpoint,
        responseTime,
        content,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.log('[LLM] Request failed with error:', errorMessage)
      console.log('[LLM] Error object:', error)

      // Detect CORS error
      if (errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('NetworkError') ||
          errorMessage.includes('CORS')) {
        console.log('[LLM] Detected CORS error')
        return {
          success: false,
          error: 'CORS 跨域错误\n\n建议：\n• 使用 Electron 桌面版\n• 使用支持跨域的 API\n• 或配置代理服务器',
          isCors: true,
        }
      }

      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Update the client configuration
   */
  updateConfig(config: Partial<LLMConfig>): void {
    const oldBaseURL = this.config.baseURL
    const oldModel = this.config.model

    this.config = { ...this.config, ...config }

    // 如果 endpoint、baseURL 或 model 变更，重置缓存
    if (config.endpoint || config.baseURL !== oldBaseURL || config.model !== oldModel) {
      this.workingEndpoint = null
    }

    // 如果 baseURL 或 model 变更，尝试从新配置的缓存中恢复
    if ((config.baseURL || config.model) && !config.endpoint) {
      const cached = localStorage.getItem(getEndpointCacheKey(this.config.baseURL, this.config.model))
      if (cached && POSSIBLE_ENDPOINTS.includes(cached as Endpoint)) {
        this.workingEndpoint = cached as Endpoint
      }
    }
  }

  /**
   * 获取当前工作的端点
   */
  getWorkingEndpoint(): string | null {
    return this.workingEndpoint
  }
}

/**
 * Create a new LLM client instance
 */
export function createLLMClient(config: LLMConfig): LLMClient {
  return new LLMClient(config)
}
