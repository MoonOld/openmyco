import { useKnowledgeStore } from '@/stores'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui'
import { Book, Code, Wrench, Lightbulb, Clock, ArrowRight, ArrowLeft, Minus, MousePointer2 } from 'lucide-react'
import { getRelationTypeName } from '@/lib/llm'
import { cn } from '@/lib/utils'

const typeIcons = {
  concept: Lightbulb,
  skill: Book,
  tool: Wrench,
  theory: Code,
}

const relationIcons = {
  prerequisite: { icon: ArrowLeft, color: 'text-red-500', label: '前置知识' },
  postrequisite: { icon: ArrowRight, color: 'text-green-500', label: '后置知识' },
  related: { icon: Minus, color: 'text-blue-500', label: '相关知识' },
  depends: { icon: Minus, color: 'text-purple-500', label: '依赖关系' },
  contains: { icon: Minus, color: 'text-orange-500', label: '包含' },
}

interface NodeDetailPanelProps {
  className?: string
}

export function NodeDetailPanel({ className }: NodeDetailPanelProps) {
  const { currentGraph, selectedNodeId, selectNode, setFocusMode } = useKnowledgeStore()

  const selectedNode = selectedNodeId
    ? currentGraph?.nodes.get(selectedNodeId)
    : null

  // 点击关系节点时，切换焦点到该节点
  const handleRelationNodeClick = (nodeId: string) => {
    selectNode(nodeId)
    // 自动开启聚焦模式
    setFocusMode(true)
  }

  // Get related nodes
  const relatedEdges = currentGraph?.edges.filter(
    (e) => e.source === selectedNodeId || e.target === selectedNodeId
  ) || []

  const incomingEdges = relatedEdges.filter((e) => e.target === selectedNodeId)
  const outgoingEdges = relatedEdges.filter((e) => e.source === selectedNodeId)

  if (!selectedNode) {
    return (
      <div className={className}>
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            选择一个节点查看详情
          </CardContent>
        </Card>
      </div>
    )
  }

  const Icon = typeIcons[selectedNode.type] || Lightbulb

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle>{selectedNode.title}</CardTitle>
              <CardDescription className="capitalize mt-1">
                {selectedNode.type} · 难度 {selectedNode.difficulty || 'N/A'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Description */}
          <div>
            <h4 className="text-sm font-medium mb-2">描述</h4>
            <p className="text-sm text-muted-foreground">{selectedNode.description}</p>
          </div>

          {/* Time estimate */}
          {selectedNode.estimatedTime && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>预计学习时间：约 {selectedNode.estimatedTime} 分钟</span>
            </div>
          )}

          {/* Tags */}
          {selectedNode.tags && selectedNode.tags.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">标签</h4>
              <div className="flex flex-wrap gap-2">
                {selectedNode.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs rounded-full bg-secondary text-secondary-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Incoming relations - 前置知识 */}
          {incomingEdges.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">前置关系</h4>
              <div className="space-y-2">
                {incomingEdges.map((edge) => {
                  const relationInfo = relationIcons[edge.type]
                  const RelationIcon = relationInfo.icon
                  const sourceNode = currentGraph?.nodes.get(edge.source)

                  return (
                    <div
                      key={edge.id}
                      onClick={() => sourceNode && handleRelationNodeClick(sourceNode.id)}
                      className={cn(
                        "flex items-center gap-2 text-sm p-2 rounded bg-muted/50",
                        sourceNode && "cursor-pointer hover:bg-muted transition-colors group"
                      )}
                    >
                      <RelationIcon className={`h-4 w-4 ${relationInfo.color}`} />
                      <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                        {sourceNode?.title || edge.source}
                      </span>
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-background">
                        {getRelationTypeName(edge.type)}
                      </span>
                      {sourceNode && (
                        <MousePointer2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Outgoing relations - 后续知识 */}
          {outgoingEdges.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">后续关系</h4>
              <div className="space-y-2">
                {outgoingEdges.map((edge) => {
                  const relationInfo = relationIcons[edge.type]
                  const RelationIcon = relationInfo.icon
                  const targetNode = currentGraph?.nodes.get(edge.target)

                  return (
                    <div
                      key={edge.id}
                      onClick={() => targetNode && handleRelationNodeClick(targetNode.id)}
                      className={cn(
                        "flex items-center gap-2 text-sm p-2 rounded bg-muted/50",
                        targetNode && "cursor-pointer hover:bg-muted transition-colors group"
                      )}
                    >
                      <RelationIcon className={`h-4 w-4 ${relationInfo.color}`} />
                      <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                        {targetNode?.title || edge.target}
                      </span>
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-background">
                        {getRelationTypeName(edge.type)}
                      </span>
                      {targetNode && (
                        <MousePointer2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
