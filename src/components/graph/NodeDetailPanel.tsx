import { useKnowledgeStore } from '@/stores'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui'
import { Book, Code, Wrench, Lightbulb, Clock, ArrowRight, ArrowLeft, Minus, MousePointer2, Eye, Beaker, Target } from 'lucide-react'
import { getRelationTypeName } from '@/lib/llm'
import { cn } from '@/lib/utils'

const typeIcons = {
  concept: Lightbulb,
  skill: Book,
  tool: Wrench,
  theory: Code,
}

const relationIcons: Record<string, { icon: typeof Minus; color: string; label: string }> = {
  prerequisite: { icon: ArrowLeft, color: 'text-red-500', label: '前置知识' },
  postrequisite: { icon: ArrowRight, color: 'text-green-500', label: '后置知识' },
  related: { icon: Minus, color: 'text-blue-500', label: '相关知识' },
  depends: { icon: Minus, color: 'text-purple-500', label: '依赖关系' },
  contains: { icon: Minus, color: 'text-orange-500', label: '包含' },
}

const defaultRelationInfo = { icon: Minus, color: 'text-gray-500', label: '关系' }

interface NodeDetailPanelProps {
  className?: string
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-sm text-muted-foreground text-center py-6">
      {message}
    </div>
  )
}

export function NodeDetailPanel({ className }: NodeDetailPanelProps) {
  const { currentGraph, selectedNodeId, selectNode, setFocusMode } = useKnowledgeStore()

  const selectedNode = selectedNodeId
    ? currentGraph?.nodes.get(selectedNodeId)
    : null

  const handleRelationNodeClick = (nodeId: string) => {
    selectNode(nodeId)
    setFocusMode(true)
  }

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

  const hasPrinciple = !!selectedNode.principle
  const hasExamples = !!(selectedNode.examples?.length || selectedNode.useCases?.length)
  const hasPractices = !!(selectedNode.bestPractices?.length || selectedNode.commonMistakes?.length)

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
        <CardContent>
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                概览
              </TabsTrigger>
              <TabsTrigger value="principle">
                <Lightbulb className="h-3.5 w-3.5 mr-1.5" />
                原理
              </TabsTrigger>
              <TabsTrigger value="examples">
                <Beaker className="h-3.5 w-3.5 mr-1.5" />
                示例
              </TabsTrigger>
              <TabsTrigger value="practices">
                <Target className="h-3.5 w-3.5 mr-1.5" />
                实践
              </TabsTrigger>
            </TabsList>

            {/* 概览 Tab */}
            <TabsContent value="overview">
              <div className="space-y-4">
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

                {/* Key Terms */}
                {selectedNode.keyTerms && selectedNode.keyTerms.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">关键术语</h4>
                    <div className="space-y-2">
                      {selectedNode.keyTerms.map((kt, index) => (
                        <div key={index} className="text-sm">
                          <span className="font-medium">{kt.term}</span>
                          <span className="text-muted-foreground"> — {kt.definition}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Incoming relations */}
                {incomingEdges.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">前置关系</h4>
                    <div className="space-y-2">
                      {incomingEdges.map((edge) => {
                        const relationInfo = relationIcons[edge.type] || defaultRelationInfo
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

                {/* Outgoing relations */}
                {outgoingEdges.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">后续关系</h4>
                    <div className="space-y-2">
                      {outgoingEdges.map((edge) => {
                        const relationInfo = relationIcons[edge.type] || defaultRelationInfo
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
              </div>
            </TabsContent>

            {/* 原理 Tab */}
            <TabsContent value="principle">
              {hasPrinciple ? (
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium mb-2">核心原理</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      {selectedNode.principle}
                    </p>
                  </div>
                </div>
              ) : (
                <EmptyState message="暂无原理说明，展开节点后自动获取" />
              )}
            </TabsContent>

            {/* 示例 Tab */}
            <TabsContent value="examples">
              {hasExamples ? (
                <div className="space-y-4">
                  {/* 应用场景 */}
                  {selectedNode.useCases && selectedNode.useCases.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">应用场景</h4>
                      <ul className="space-y-1.5">
                        {selectedNode.useCases.map((uc, index) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-primary mt-0.5 shrink-0">•</span>
                            <span>{uc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 示例 */}
                  {selectedNode.examples && selectedNode.examples.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">代码示例</h4>
                      <div className="space-y-3">
                        {selectedNode.examples.map((example, index) => (
                          <div key={index} className="rounded-lg border bg-muted/30 overflow-hidden">
                            <div className="px-3 py-2 border-b bg-muted/50">
                              <h5 className="text-sm font-medium">{example.title}</h5>
                            </div>
                            {example.code && (
                              <pre className="px-3 py-2 text-xs overflow-x-auto bg-background">
                                <code>{example.code}</code>
                              </pre>
                            )}
                            <div className="px-3 py-2">
                              <p className="text-sm text-muted-foreground">{example.explanation}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState message="暂无示例，展开节点后自动获取" />
              )}
            </TabsContent>

            {/* 实践 Tab */}
            <TabsContent value="practices">
              {hasPractices ? (
                <div className="space-y-4">
                  {/* 最佳实践 */}
                  {selectedNode.bestPractices && selectedNode.bestPractices.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">最佳实践</h4>
                      <ul className="space-y-1.5">
                        {selectedNode.bestPractices.map((bp, index) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                            <span>{bp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 常见错误 */}
                  {selectedNode.commonMistakes && selectedNode.commonMistakes.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">常见错误</h4>
                      <ul className="space-y-1.5">
                        {selectedNode.commonMistakes.map((cm, index) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-red-500 mt-0.5 shrink-0">✗</span>
                            <span>{cm}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState message="暂无实践建议，展开节点后自动获取" />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
