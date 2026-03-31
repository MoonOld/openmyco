import { Handle, Position, type NodeProps } from 'reactflow'
import { Book, Code, Wrench, Lightbulb, Loader2, Sparkles, CheckCircle2, Pencil, AlertCircle, RotateCcw, Microscope } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KnowledgeNode } from '@/types'

interface GraphNodeData {
  knowledgeNode: KnowledgeNode
  onExpand?: (nodeId: string) => void
  onDeepen?: (nodeId: string) => void
  onSelect?: (nodeId: string) => void
  onEdit?: (nodeId: string) => void
  onRetry?: (nodeId: string) => void
  selected?: boolean
  isLoading?: boolean
  isDeepenLoading?: boolean
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

  const handleDeepen = (e: React.MouseEvent) => {
    e.stopPropagation()
    data.onDeepen?.(node.id)
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    data.onEdit?.(node.id)
  }

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation()
    data.onRetry?.(node.id)
  }

  // 状态计算
  const isExpandLoading = data.isLoading || false
  const isDeepenLoading = data.isDeepenLoading || false
  const isExpanded = node.expanded
  const isContentLoading = node.description === ''

  // 扩展状态（兼容旧 operationStatus）
  const expandStatus = node.expandStatus ?? (node.operationStatus as 'pending' | 'success' | 'failed' | undefined)
  const isExpandPending = expandStatus === 'pending'
  const isExpandFailed = expandStatus === 'failed'

  // 深化状态
  const deepenStatus = node.deepenStatus
  const isDeepenPending = deepenStatus === 'pending'
  const isDeepenFailed = deepenStatus === 'failed'
  const isDeepened = deepenStatus === 'success'

  // 按钮可用性
  const canExpand = !isExpandLoading && !isContentLoading && !isExpanded && !isExpandPending
  const canDeepen = node.description !== ''
    && !isDeepenLoading
    && !isDeepenPending
    && (!isDeepened || isDeepenFailed)

  return (
    <div
      className={cn(
        'min-w-[200px] max-w-[280px] rounded-lg border-2 bg-white shadow-md transition-all cursor-pointer',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-gray-300 hover:border-gray-400',
        isExpandFailed && 'border-red-400 bg-red-50'
      )}
      onClick={handleClick}
    >
      {/* Input handle */}
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />

      {/* Node header */}
      <div className="flex items-center gap-2 p-3 border-b bg-gray-50 rounded-t-lg">
        <Icon className="h-4 w-4 text-gray-600" />
        <span className="flex-1 text-sm font-medium truncate">{node.title}</span>

        {/* 扩展按钮 */}
        {isExpandFailed ? (
          <button
            onClick={handleRetry}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 transition-colors"
            title={node.expandError || '扩展失败，点击重试'}
          >
            <RotateCcw className="h-3 w-3" />
            <span>重试</span>
          </button>
        ) : isExpanded ? (
          <button
            onClick={handleExpand}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 transition-colors"
            title="已扩展"
          >
            <CheckCircle2 className="h-3 w-3" />
            <span>已扩展</span>
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
            title={isContentLoading ? "等待加载完成..." : isExpandPending ? "正在处理..." : "扩展关联节点"}
            disabled={!canExpand}
          >
            {isExpandLoading || isContentLoading || isExpandPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            <span>{isContentLoading ? '加载中' : isExpandLoading || isExpandPending ? '处理中' : '扩展'}</span>
          </button>
        )}

        {/* 深化按钮（图标按钮） */}
        {isExpandFailed ? null : (
          <div className="relative">
            <button
              onClick={handleDeepen}
              className={cn(
                "p-1.5 rounded-full transition-all",
                isDeepenFailed
                  ? "bg-red-100 text-red-700 border border-red-200 hover:bg-red-200"
                  : isDeepened
                    ? "bg-green-50 text-green-600 border border-green-200"
                    : canDeepen
                      ? "bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 hover:shadow-sm"
                      : "bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-100"
              )}
              title={
                isDeepenFailed
                  ? node.deepenError || '深化失败，点击重试'
                  : isDeepened
                    ? '已深化'
                    : canDeepen
                      ? '深化：获取详细内容'
                      : '需要先有描述才能深化'
              }
              disabled={!canDeepen && !isDeepenFailed}
            >
              {isDeepenLoading || isDeepenPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Microscope className="h-3.5 w-3.5" />
              )}
            </button>
            {/* 未深化时显示提示圆点 */}
            {canDeepen && !isDeepened && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            )}
          </div>
        )}
      </div>

      {/* Node content */}
      <div className="p-3 space-y-2">
        {/* Error message (expand) */}
        {isExpandFailed && (node.expandError || node.operationError) && (
          <div className="flex items-center gap-2 p-2 text-xs text-red-600 bg-red-100 rounded-md">
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            <span className="line-clamp-2">{node.expandError || node.operationError}</span>
          </div>
        )}

        {/* Error message (deepen) */}
        {isDeepenFailed && node.deepenError && (
          <div className="flex items-center gap-2 p-2 text-xs text-orange-600 bg-orange-100 rounded-md">
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            <span className="line-clamp-2">{node.deepenError}</span>
          </div>
        )}

        {/* Description */}
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
        {node.description !== '' && !isExpandFailed && (
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
