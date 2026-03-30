import React, { useState, useRef, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { Input, Button } from '@/components/ui'
import { useKnowledgeStore, useSettingsStore, useUIStore } from '@/stores'
import { createGraph } from '@/services/operationService'

interface ChatInputProps {
  className?: string
}

export function ChatInput({ className }: ChatInputProps) {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { llmConfig } = useSettingsStore()
  const { setError } = useKnowledgeStore()
  const { addToast } = useUIStore()

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

    try {
      // 调用统一的操作服务
      const result = await createGraph(topic)

      if (!result.success) {
        setError(result.error || '生成知识图谱失败')
        return
      }

      // 如果用户切换了图谱，显示提示
      if (!result.wasCurrentGraph) {
        console.log(`[ChatInput] 图谱 "${result.graphName}" 已在后台生成完成`)
        addToast({
          variant: 'default',
          title: '图谱生成完成',
          description: `图谱 "${result.graphName}" 已在后台生成完成`,
        })
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
