import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { Button } from '@/components/ui'
import type { KnowledgeNode } from '@/types'
import { cn } from '@/lib/utils'

interface NodeEditDialogProps {
  node: KnowledgeNode
  isOpen: boolean
  onClose: () => void
  onSave: (updates: Partial<KnowledgeNode>) => void
}

const nodeTypes = [
  { value: 'concept', label: '概念' },
  { value: 'skill', label: '技能' },
  { value: 'tool', label: '工具' },
  { value: 'theory', label: '理论' },
] as const

const difficultyLevels: { value: 1 | 2 | 3 | 4 | 5; label: string; color: string }[] = [
  { value: 1, label: '入门', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 2, label: '简单', color: 'bg-lime-100 text-lime-700 border-lime-200' },
  { value: 3, label: '中等', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 4, label: '困难', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 5, label: '专家', color: 'bg-red-100 text-red-700 border-red-200' },
]

export function NodeEditDialog({ node, isOpen, onClose, onSave }: NodeEditDialogProps) {
  const [title, setTitle] = useState(node.title)
  const [description, setDescription] = useState(node.description)
  const [type, setType] = useState<KnowledgeNode['type']>(node.type)
  const [difficulty, setDifficulty] = useState(node.difficulty || 3)
  const [estimatedTime, setEstimatedTime] = useState(node.estimatedTime?.toString() || '')
  const [tags, setTags] = useState(node.tags?.join(', ') || '')

  // 当 node 变化时，通过 key 来重置状态，而不是在 effect 中设置
  // 这是由父组件控制 key={node.id} 来实现的

  if (!isOpen) return null

  const handleSave = () => {
    onSave({
      title: title.trim() || node.title,
      description: description.trim(),
      type,
      difficulty,
      estimatedTime: estimatedTime ? parseInt(estimatedTime, 10) : undefined,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">编辑知识点</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1">标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="知识点标题"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              placeholder="知识点描述"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium mb-2">类型</label>
            <div className="flex gap-2 flex-wrap">
              {nodeTypes.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={cn(
                    'px-3 py-1 text-xs rounded-full border transition-colors',
                    type === t.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted hover:bg-muted/80 border-border'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-sm font-medium mb-2">难度</label>
            <div className="flex gap-2">
              {difficultyLevels.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDifficulty(d.value)}
                  className={cn(
                    'w-8 h-8 text-xs rounded-full border transition-all',
                    difficulty === d.value
                      ? `${d.color} ring-2 ring-offset-1 ring-primary/50`
                      : 'bg-muted hover:bg-muted/80 border-border'
                  )}
                >
                  {d.value}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              当前: {difficultyLevels.find(d => d.value === difficulty)?.label}
            </p>
          </div>

          {/* Estimated Time */}
          <div>
            <label className="block text-sm font-medium mb-1">预计学习时间（分钟）</label>
            <input
              type="number"
              value={estimatedTime}
              onChange={(e) => setEstimatedTime(e.target.value)}
              min={1}
              className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="例如: 30"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-1">标签（逗号分隔）</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="例如: React, 前端, JavaScript"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="ghost" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save className="h-3 w-3 mr-1" />
            保存
          </Button>
        </div>
      </div>
    </div>
  )
}
