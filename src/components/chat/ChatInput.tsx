import React, { useState, useRef, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { Input, Button } from '@/components/ui'
import { useKnowledgeStore, useSettingsStore } from '@/stores'
import { createLLMClient, normalizeLLMResponse } from '@/lib/llm'
import { generateId } from '@/lib/utils'
import type { KnowledgeEdge, KnowledgeNode } from '@/types'
import { GraphRepository } from '@/lib/storage'

interface ChatInputProps {
  className?: string
}

export function ChatInput({ className }: ChatInputProps) {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { llmConfig } = useSettingsStore()
  const { initEmptyGraphWithRoot, setError } = useKnowledgeStore()

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

    // ========== 1. 记录操作上下文 ==========
    const tempNodeId = generateId()
    let targetGraphId: string

    // 创建临时节点（显示"正在生成"状态）
    const tempNode: KnowledgeNode = {
      id: tempNodeId,
      title: topic,
      description: '正在生成知识图谱...',
      type: 'concept',
      expanded: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // 检查当前图谱状态
    const graph = useKnowledgeStore.getState().currentGraph
    const isEmpty = useKnowledgeStore.getState().isEmptyGraph()

    if (!graph || !isEmpty) {
      // 没有图谱 或 图谱不为空 → 创建新图谱
      initEmptyGraphWithRoot(tempNode)
      targetGraphId = useKnowledgeStore.getState().currentGraph!.id

      // 立即保存到 IndexedDB 并通知侧边栏刷新
      const { currentGraph: newGraph } = useKnowledgeStore.getState()
      if (newGraph) {
        await GraphRepository.save(newGraph)
        window.dispatchEvent(new CustomEvent('graph-updated'))
      }
    } else {
      // 图谱为空 → 直接往空图谱里添加根节点
      targetGraphId = graph.id
      initEmptyGraphWithRoot(tempNode)
    }

    console.log('[ChatInput] Operation context:', { targetGraphId, tempNodeId, topic })

    try {
      const client = createLLMClient(llmConfig)

      // ========== 2. 调用 LLM（可能耗时较长）==========
      const response = await client.generateKnowledgeGraphV2(topic)

      if (!response) {
        setError('未能获取知识图谱，请重试')
        return
      }

      console.log('[ChatInput] LLM V2 response:', response)

      // ========== 3. 定向更新目标图谱（核心改动）==========
      // 使用 normalizer 转换 ref -> localId
      const normalized = normalizeLLMResponse(response, tempNodeId)
      const { rootNode, relatedNodes, edges: normalizedEdges } = normalized

      // 准备边数据
      const knowledgeEdges: KnowledgeEdge[] = normalizedEdges.map((edge) => ({
        id: generateId(),
        source: edge.source,
        target: edge.target,
        type: edge.type,
        weight: edge.weight,
      }))

      // 使用定向更新方法
      const result = await useKnowledgeStore.getState().updateGraphById(targetGraphId, {
        rootNodeId: tempNodeId,
        rootNodeUpdates: {
          title: rootNode.title,
          description: rootNode.description,
          type: rootNode.type,
          difficulty: rootNode.difficulty,
          estimatedTime: rootNode.estimatedTime,
          resources: rootNode.resources,
          tags: rootNode.tags,
          expanded: true,
        },
        newNodes: relatedNodes,
        newEdges: knowledgeEdges,
        graphName: rootNode.title,
      })

      if (!result.success) {
        setError(result.error || '更新图谱失败')
        return
      }

      // ========== 4. 如果用户切换了图谱，显示提示 ==========
      if (!result.isCurrentGraph) {
        console.log(`[ChatInput] 图谱 "${result.graphName}" 已在后台生成完成`)
        // TODO: 使用 toast 组件替代
        setError(`图谱 "${result.graphName}" 已生成完成`)
      }

      console.log('[ChatInput] Graph update result:', result)

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
