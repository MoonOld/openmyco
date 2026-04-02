import { useState } from 'react'
import { useKnowledgeStore } from '@/stores'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui'
import { Book, Code, Wrench, Lightbulb, Clock, ArrowRight, ArrowLeft, Minus, MousePointer2, Eye, Target, MessageCircle, GitBranch, Sparkles, Brain, Loader2, AlertCircle, Trophy } from 'lucide-react'
import { getRelationTypeName } from '@/lib/llm'
import { cn } from '@/lib/utils'
import { QAPanel } from './QAPanel'
import { advancedDeepen } from '@/services/operationService'
import type { KnowledgeNode } from '@/types'

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
  const hasRelations = incomingEdges.length > 0 || outgoingEdges.length > 0

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
          <Accordion type="multiple" defaultValue={['understand', 'explore']}>
            {/* 认识面板 — Remember + Understand */}
            <AccordionItem value="understand">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  认识
                </span>
              </AccordionTrigger>
              <AccordionContent>
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

                  {/* Analogies */}
                  {selectedNode.analogies && selectedNode.analogies.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        类比理解
                      </h4>
                      <div className="space-y-3">
                        {selectedNode.analogies.map((a, index) => (
                          <div key={index} className="rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 p-3">
                            <p className="text-sm">{a.analogy}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              <span className="font-medium">映射：</span>{a.mapsTo}
                            </p>
                            {a.limitation && (
                              <p className="text-xs text-muted-foreground/70 mt-0.5">
                                <span className="font-medium">局限：</span>{a.limitation}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 原理面板 — Understand 深层 */}
            <AccordionItem value="principle">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  原理
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {hasPrinciple ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">核心原理</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                        {selectedNode.principle}
                      </p>
                    </div>

                    {/* Sub Topics */}
                    {selectedNode.subTopics && selectedNode.subTopics.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">子话题</h4>
                        <div className="space-y-2">
                          {selectedNode.subTopics.map((st, index) => (
                            <div key={index} className="rounded-lg border bg-muted/30 p-3">
                              <h5 className="text-sm font-medium">{st.title}</h5>
                              <p className="text-sm text-muted-foreground mt-0.5">{st.description}</p>
                              {st.keyPoints && st.keyPoints.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {st.keyPoints.map((kp, kpIndex) => (
                                    <span
                                      key={kpIndex}
                                      className="px-2 py-0.5 text-xs rounded-full bg-secondary text-secondary-foreground"
                                    >
                                      {kp}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyState message="暂无深化信息，点击节点上的深化按钮获取详细内容" />
                )}
              </AccordionContent>
            </AccordionItem>

            {/* 应用面板 — Apply */}
            <AccordionItem value="apply">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  应用
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {hasExamples || hasPractices ? (
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

                    {/* 代码示例 */}
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
                  <EmptyState message="暂无深化信息，点击节点上的深化按钮获取详细内容" />
                )}
              </AccordionContent>
            </AccordionItem>

            {/* 关系面板 */}
            <AccordionItem value="relations">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  关系
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {hasRelations ? (
                  <div className="space-y-4">
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
                ) : (
                  <EmptyState message="暂无关联知识点" />
                )}
              </AccordionContent>
            </AccordionItem>

            {/* 反思与挑战面板 — Evaluate + Create (Layer 2) */}
            <AccordionItem value="advanced">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  反思与挑战
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <AdvancedSection node={selectedNode} />
              </AccordionContent>
            </AccordionItem>

            {/* 探索面板 */}
            <AccordionItem value="explore">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  探索
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <QAPanel nodeId={selectedNode.id} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== 反思与挑战子组件 ====================

const levelLabels: Record<string, { label: string; color: string }> = {
  surface: { label: '表面理解', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  deep: { label: '深层机制', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  transfer: { label: '跨域迁移', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
}

const difficultyLabels: Record<string, { label: string; color: string }> = {
  guided: { label: '引导式', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  open: { label: '开放式', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  extended: { label: '拓展式', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
}

function AdvancedSection({ node }: { node: KnowledgeNode }) {
  const [loading, setLoading] = useState(false)

  const status = node.advancedDeepenStatus
  const error = node.advancedDeepenError
  const hasData = !!(node.reflectionPrompts?.length || node.challenge)
  const isDeepened = node.deepenStatus === 'success'

  const handleFetch = async () => {
    setLoading(true)
    await advancedDeepen(node.id)
    setLoading(false)
  }

  // 前置条件不满足
  if (!isDeepened) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        请先完成基础深化后再获取高阶内容
      </div>
    )
  }

  // Loading 状态
  if (status === 'pending' || loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        正在获取高阶内容...
      </div>
    )
  }

  // Error 状态
  if (status === 'failed') {
    return (
      <div className="space-y-3 py-2">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error || '获取高阶内容失败'}</span>
        </div>
        <button
          onClick={handleFetch}
          className="w-full px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          重试
        </button>
      </div>
    )
  }

  // 成功但无数据
  if (status === 'success' && !hasData) {
    return (
      <div className="space-y-3 py-2">
        <p className="text-sm text-muted-foreground">未获取到有效的高阶内容</p>
        <button
          onClick={handleFetch}
          className="w-full px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          重试
        </button>
      </div>
    )
  }

  // 有数据 — 展示
  if (hasData) {
    return (
      <div className="space-y-5">
        {/* 反思引导 */}
        {node.reflectionPrompts && node.reflectionPrompts.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5 text-purple-500" />
              反思引导
            </h4>
            <div className="space-y-3">
              {node.reflectionPrompts.map((rp, index) => {
                const levelInfo = levelLabels[rp.level] || levelLabels.surface
                return (
                  <div key={index} className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={cn('px-2 py-0.5 text-xs rounded-full', levelInfo.color)}>
                        {levelInfo.label}
                      </span>
                    </div>
                    <p className="text-sm">{rp.question}</p>
                    {rp.hint && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        <span className="font-medium">提示：</span>{rp.hint}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 挑战任务 */}
        {node.challenge && (() => {
          const ch = node.challenge
          const diffInfo = difficultyLabels[ch.difficulty] || difficultyLabels.open
          return (
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
                挑战任务
              </h4>
              <div className="rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{ch.title}</span>
                  <span className={cn('px-2 py-0.5 text-xs rounded-full', diffInfo.color)}>
                    {diffInfo.label}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{ch.description}</p>

                {ch.requirements.length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground mb-1.5">要求</h5>
                    <ul className="space-y-1">
                      {ch.requirements.map((req, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {ch.extensions && ch.extensions.length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground mb-1.5">扩展挑战</h5>
                    <ul className="space-y-1">
                      {ch.extensions.map((ext, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-amber-400 mt-0.5 shrink-0">+</span>
                          <span>{ext}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {ch.suggestedApproach && (
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground mb-1.5">建议思路</h5>
                    <p className="text-sm text-muted-foreground">{ch.suggestedApproach}</p>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        <button
          onClick={handleFetch}
          className="w-full px-3 py-2 text-xs rounded-md border hover:bg-muted transition-colors text-muted-foreground"
        >
          重新获取高阶内容
        </button>
      </div>
    )
  }

  // 默认：未获取状态
  return (
    <div className="py-2">
      <button
        onClick={handleFetch}
        className="w-full px-3 py-2.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        获取高阶内容
      </button>
      <p className="text-xs text-muted-foreground text-center mt-2">
        获取反思引导和实践挑战
      </p>
    </div>
  )
}
