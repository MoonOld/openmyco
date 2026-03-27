import { Handle, Position, type NodeProps } from 'reactflow'
import { Book, Code, Wrench, Lightbulb, Loader2, Sparkles, CheckCircle2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KnowledgeNode } from '@/types'

interface GraphNodeData {
  knowledgeNode: KnowledgeNode
  onExpand?: (nodeId: string) => void
  onSelect?: (nodeId: string) => void
  onEdit?: (nodeId: string) => void
  selected?: boolean
  isLoading?: boolean
}

const typeIcons = {
  concept: Lightbulb,
  skill: Book,
  tool: Wrench,
  theory: Code,
}

const difficultyColors = {
  1: 'bg-green-100 text-green-700 border-green-200',
  2: 'bg-lime-100 text-lime-700 border-lime-200',
  3: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  4: 'bg-orange-100 text-orange-700 border-orange-200',
  5: 'bg-red-100 text-red-700 border-red-200',
}

export function GraphNode({ data, selected }: NodeProps<GraphNodeData>) {
  const node = data.knowledgeNode
  const Icon = typeIcons[node.type] || Lightbulb

  const handleClick = () => {
    data.onSelect?.(node.id)
  }

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    data.onExpand?.(node.id)
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    data.onEdit?.(node.id)
  }

  const isLoading = data.isLoading || false
  const isContentLoading = node.description === '' // 骨架节点正在加载详情
  const isExpanded = node.expanded
  const canExpand = !isLoading && !isContentLoading && !isExpanded

  return (
    <div
      className={cn(
        'min-w-[200px] max-w-[280px] rounded-lg border-2 bg-white shadow-md transition-all cursor-pointer',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-gray-300 hover:border-gray-400'
      )}
      onClick={handleClick}
    >
      {/* Input handle */}
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />

      {/* Node header */}
      <div className="flex items-center gap-2 p-3 border-b bg-gray-50 rounded-t-lg">
        <Icon className="h-4 w-4 text-gray-600" />
        <span className="flex-1 text-sm font-medium truncate">{node.title}</span>
        {/* Expand button */}
        {isExpanded ? (
          <button
            onClick={handleExpand}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 transition-colors"
            title="已探索，点击重新探索"
          >
            <CheckCircle2 className="h-3 w-3" />
            <span>已探索</span>
          </button>
        ) : (
          <button
            onClick={handleExpand}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-xs rounded-full transition-all",
              canExpand
                ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-sm hover:shadow"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            )}
            title={isContentLoading ? "等待加载完成..." : "探索相关知识"}
            disabled={!canExpand}
          >
            {isLoading || isContentLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            <span>{isContentLoading ? '加载中' : isLoading ? '探索中' : '探索'}</span>
          </button>
        )}
      </div>

      {/* Node content */}
      <div className="p-3 space-y-2">
        {/* 描述：空字符串表示骨架节点正在加载详情 */}
        {node.description === '' ? (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>正在加载详情...</span>
          </div>
        ) : (
          <p className="text-xs text-gray-600 line-clamp-2">{node.description}</p>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-2 flex-wrap">
          {node.difficulty && (
            <span className={cn(
              'px-2 py-0.5 text-xs rounded-full border',
              difficultyColors[node.difficulty]
            )}>
              难度 {node.difficulty}
            </span>
          )}
          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 border border-gray-200">
            {node.type}
          </span>
        </div>

        {node.estimatedTime && (
          <p className="text-xs text-gray-500">
            约 {node.estimatedTime} 分钟
          </p>
        )}

        {/* Edit button */}
        {node.description !== '' && (
          <button
            onClick={handleEdit}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors w-full justify-center"
            title="编辑节点信息"
          >
            <Pencil className="h-3 w-3" />
            <span>编辑</span>
          </button>
        )}
      </div>

      {/* Output handle */}
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </div>
  )
}
