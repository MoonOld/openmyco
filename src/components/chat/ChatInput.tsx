import React, { useState, useRef, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { Input, Button } from '@/components/ui'
import { useKnowledgeStore, useSettingsStore } from '@/stores'
import { createLLMClient, normalizeLLMResponse } from '@/lib/llm'
import { generateId } from '@/lib/utils'
import type { KnowledgeEdge } from '@/types'
import { GraphRepository } from '@/lib/storage'

interface ChatInputProps {
  className?: string
}

export function ChatInput({ className }: ChatInputProps) {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { llmConfig } = useSettingsStore()
  const { addNodes, addEdges, initEmptyGraphWithRoot, updateNode, setError } = useKnowledgeStore()

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const validateConfig = (): boolean => {
    if (!llmConfig.apiKey) {
      setError('请先在设置中配置 API Key')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const topic = input.trim()
    if (!topic || isLoading) return

    if (!validateConfig()) {
      return
    }

    setIsLoading(true)
    setInput('')
    setError(null)

    // 记录临时节点 ID（用于后续 normalizer）
    let tempNodeId: string | null = null

    // 记录目标图谱 ID（用于检测用户是否切换了图谱）
    let targetGraphId: string | null = null

    // 检查当前图谱状态
    const graph = useKnowledgeStore.getState().currentGraph
    const isEmpty = useKnowledgeStore.getState().isEmptyGraph()

    if (!graph || !isEmpty) {
      // 没有图谱 或 图谱不为空 → 创建新图谱
      tempNodeId = generateId()

      // 创建空图谱并设置加载状态
      initEmptyGraphWithRoot({
        id: tempNodeId,
        title: topic,
        description: '正在生成知识图谱...',
        type: 'concept',
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // 记录目标图谱 ID
      targetGraphId = useKnowledgeStore.getState().currentGraph?.id ?? null

      // 立即保存到 IndexedDB 并通知侧边栏刷新
      const { currentGraph: newGraph } = useKnowledgeStore.getState()
      if (newGraph) {
        await GraphRepository.save(newGraph)
        window.dispatchEvent(new CustomEvent('graph-updated'))
      }
    } else {
      // 图谱为空 → 直接往空图谱里添加根节点
      tempNodeId = generateId()
      targetGraphId = graph.id

      // 在空图谱中初始化根节点
      initEmptyGraphWithRoot({
        id: tempNodeId,
        title: topic,
        description: '正在生成知识图谱...',
        type: 'concept',
        expanded: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    try {
      const client = createLLMClient(llmConfig)

      // ========== 新架构：使用 V2 + Normalizer ==========
      // 调用 V2 API，LLM 返回 ref (root, n1, n2...) 而非 UUID
      const response = await client.generateKnowledgeGraphV2(topic)

      if (!response) {
        setError('未能获取知识图谱，请重试')
        return
      }

      console.log('[ChatInput] LLM V2 response:', response)

      // 检查用户是否切换了图谱
      const currentGraphId = useKnowledgeStore.getState().currentGraph?.id
      if (currentGraphId !== targetGraphId) {
        console.warn('[ChatInput] 用户已切换图谱，取消当前生成操作')
        setError('已切换到其他图谱，生成已取消')
        return
      }

      // 获取临时节点 ID（作为 root 的 canonical ID）
      const graph = useKnowledgeStore.getState().currentGraph
      if (!graph || graph.nodes.size === 0) {
        setError('图谱状态异常')
        return
      }

      const rootCanonicalId = tempNodeId || Array.from(graph.nodes.values())[0]!.id
      console.log('[ChatInput] Root canonical ID:', rootCanonicalId)

      // 使用 normalizer 转换 ref -> localId
      const normalized = normalizeLLMResponse(response, rootCanonicalId)
      console.log('[ChatInput] Normalized response:', normalized)

      // 更新临时节点内容（保留原 ID）
      const { rootNode, relatedNodes, edges: normalizedEdges } = normalized

      updateNode(rootCanonicalId, {
        title: rootNode.title,
        description: rootNode.description,
        type: rootNode.type,
        difficulty: rootNode.difficulty,
        estimatedTime: rootNode.estimatedTime,
        resources: rootNode.resources,
        tags: rootNode.tags,
        expanded: true,
      })

      // 标记为已展开
      useKnowledgeStore.getState().setExpanded(rootCanonicalId, true)

      // 更新图谱名称
      const currentGraphState = useKnowledgeStore.getState().currentGraph
      if (currentGraphState) {
        useKnowledgeStore.setState({
          currentGraph: {
            ...currentGraphState,
            name: rootNode.title,
          }
        })
      }

      // 添加关联节点
      console.log('[ChatInput] Adding related nodes:', relatedNodes.length)
      addNodes(relatedNodes)

      // 创建边（使用本地 canonical ID）
      const knowledgeEdges: KnowledgeEdge[] = normalizedEdges.map((edge) => ({
        id: generateId(),
        source: edge.source,
        target: edge.target,
        type: edge.type,
        weight: edge.weight,
      }))

      console.log('[ChatInput] Adding edges:', knowledgeEdges.length)
      addEdges(knowledgeEdges)

      // Debug: 检查最终状态
      const finalGraph = useKnowledgeStore.getState().currentGraph
      console.log('[ChatInput] Final graph - nodes:', finalGraph?.nodes.size, 'edges:', finalGraph?.edges.length)

      // 保存到存储
      const { currentGraph: updatedGraph } = useKnowledgeStore.getState()
      if (updatedGraph) {
        await GraphRepository.save(updatedGraph)
        window.dispatchEvent(new CustomEvent('graph-updated'))
      }
    } catch (error) {
      console.error('Failed to generate knowledge graph:', error)
      setError(error instanceof Error ? error.message : '生成知识图谱时出错')
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入一个知识点开始学习...（例如：React Hooks、机器学习、数据结构）"
            disabled={isLoading}
            className="pr-12"
          />
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      {!llmConfig.apiKey && (
        <p className="text-xs text-destructive mt-2">
          请先在设置中配置 API Key
        </p>
      )}
    </form>
  )
}
