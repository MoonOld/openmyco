import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  type Node,
  type Edge,
  type Connection,
  Background,
  Controls,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  Panel,
} from 'reactflow'
import 'reactflow/dist/style.css'
import dagre from '@dagrejs/dagre'
import { RefreshCw } from 'lucide-react'
import { useKnowledgeStore, useSettingsStore, useUIStore } from '@/stores'
import { GraphRepository } from '@/lib/storage'
import { cn } from '@/lib/utils'
import type { KnowledgeNode } from '@/types'
import type { GraphUpdateEvent, GraphUpdateEventDetail } from '@/types/events'
import { computeStructureSignature } from '@/types/events'
import { expandOnly, deepenOnly } from '@/services/operationService'
import { GraphNode } from './GraphNode'
import { GraphEdge as GraphEdgeComponent } from './GraphEdge'
import { NodeEditDialog } from './NodeEditDialog'
import { edgeLegend } from './edgeConfig'

const nodeTypes = {
  knowledgeNode: GraphNode,
}

const edgeTypes = {
  custom: GraphEdgeComponent,
}

// Dagre layout configuration
const dagreGraph = new dagre.graphlib.Graph()
dagreGraph.setDefaultEdgeLabel(() => ({}))

const nodeWidth = 240
const nodeHeight = 120

// Only layout nodes that don't have positions
function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  existingPositions: Map<string, { x: number; y: number }>
): { nodes: Node[]; edges: Edge[] } {
  // Separate nodes with and without positions
  const nodesWithPositions: Node[] = []
  const nodesWithoutPositions: Node[] = []

  nodes.forEach((node) => {
    if (existingPositions.has(node.id)) {
      nodesWithPositions.push({
        ...node,
        position: existingPositions.get(node.id)!,
      })
    } else {
      nodesWithoutPositions.push(node)
    }
  })

  // Only layout nodes without positions
  if (nodesWithoutPositions.length === 0) {
    return { nodes: nodesWithPositions, edges }
  }

  dagreGraph.setGraph({
    rankdir: 'TB',
    nodesep: 100,
    ranksep: 150,
    marginx: 80,
    marginy: 80,
  })

  // Add all nodes to dagre for proper spacing calculation
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
  })

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  // Apply layout positions, but only for nodes without existing positions
  const layoutedNodes = nodes.map((node) => {
    if (existingPositions.has(node.id)) {
      return {
        ...node,
        position: existingPositions.get(node.id)!,
      }
    }
    const nodeWithPosition = dagreGraph.node(node.id)
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}

interface KnowledgeGraphProps {
  className?: string
}

export function KnowledgeGraph({ className }: KnowledgeGraphProps) {
  const {
    currentGraph,
    selectedNodeId,
    expandedNodeIds,
    loadingNodes,
    loadingDeepenNodes,
    focusMode,
    focusDepth,
    selectNode,
    updateNode,
    setFocusMode,
  } = useKnowledgeStore()

  const { autoLayout } = useSettingsStore()
  const { addToast } = useUIStore()
  const { fitView } = useReactFlow()

  // 仅在切换图谱时自动 fitView（不因选中节点等操作触发）
  useEffect(() => {
    if (currentGraph) {
      const timer = setTimeout(() => {
        fitView({ duration: 300, padding: 0.2 })
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [currentGraph?.id, fitView])

  // 结构变更后 fitView（新节点加入时重新适应视图）
  const structureNodeCountRef = useRef(0)
  useEffect(() => {
    if (!currentGraph) return
    const count = currentGraph.nodes.size
    // 首次加载由 currentGraph?.id 的 effect 处理，只关注后续的节点增加
    if (count > structureNodeCountRef.current && structureNodeCountRef.current > 0) {
      const timer = setTimeout(() => {
        fitView({ duration: 300, padding: 0.2 })
      }, 300)
      structureNodeCountRef.current = count
      return () => clearTimeout(timer)
    }
    structureNodeCountRef.current = count
  }, [currentGraph?.nodes.size, fitView, currentGraph])

  // 处理节点扩展（只做骨架获取 + 去重 + 写入节点/边）
  const handleExpandNode = useCallback(async (nodeId: string) => {
    const result = await expandOnly(nodeId)    // 如果操作成功但用户已切换到其他图谱，显示 toast 提示
    if (result.success && !result.wasCurrentGraph) {
      addToast({
        variant: 'default',
        title: '节点展开完成',
        description: `图谱 "${result.graphName}" 中的节点已在后台展开完成`,
      })
    }
  }, [addToast])

  // 处理节点深化（只做深度内容获取 + 写入）
  const handleDeepenNode = useCallback(async (nodeId: string, options?: { force?: boolean }) => {
    const result = await deepenOnly(nodeId, options)
    if (result.success && !result.wasCurrentGraph) {
      addToast({
        variant: 'default',
        title: '节点深化完成',
        description: `图谱 "${result.graphName}" 中的节点已在后台深化完成`,
      })
    }
  }, [addToast])

  // 编辑弹窗状态
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const editingNode = editingNodeId ? currentGraph?.nodes.get(editingNodeId) : null

  // Calculate visible nodes based on focus mode
  const visibleNodeIds = useMemo(() => {
    console.log('[visibleNodeIds] Calculating...', {
      hasGraph: !!currentGraph,
      focusMode,
      selectedNodeId,
      nodesCount: currentGraph?.nodes.size,
      edgesCount: currentGraph?.edges.length,
    })

    if (!currentGraph || !focusMode || !selectedNodeId) {
      // Show all nodes if focus mode is off or no node is selected
      const allNodeIds = new Set(currentGraph?.nodes.keys() || [])
      console.log('[visibleNodeIds] Showing all nodes:', allNodeIds.size)
      return allNodeIds
    }

    // Build adjacency map from edges
    const adjacencyMap = new Map<string, Set<string>>()
    currentGraph.edges.forEach((edge) => {
      if (!adjacencyMap.has(edge.source)) {
        adjacencyMap.set(edge.source, new Set())
      }
      if (!adjacencyMap.has(edge.target)) {
        adjacencyMap.set(edge.target, new Set())
      }
      adjacencyMap.get(edge.source)!.add(edge.target)
      adjacencyMap.get(edge.target)!.add(edge.source)
    })

    console.log('[visibleNodeIds] Adjacency map size:', adjacencyMap.size)
    console.log('[visibleNodeIds] Adjacency map:', Object.fromEntries(
      Array.from(adjacencyMap.entries()).map(([k, v]) => [k, Array.from(v)])
    ))

    // BFS to find neighbors within focusDepth
    const visible = new Set<string>([selectedNodeId])
    let frontier = new Set<string>([selectedNodeId])

    for (let i = 0; i < focusDepth; i++) {
      const nextFrontier = new Set<string>()
      frontier.forEach((nodeId) => {
        const neighbors = adjacencyMap.get(nodeId)
        if (neighbors) {
          neighbors.forEach((neighborId) => {
            if (!visible.has(neighborId)) {
              visible.add(neighborId)
              nextFrontier.add(neighborId)
            }
          })
        }
      })
      frontier = nextFrontier
    }

    console.log('[visibleNodeIds] Final visible nodes:', visible.size, Array.from(visible))

    return visible
  }, [currentGraph, focusMode, focusDepth, selectedNodeId])

  // Convert knowledge graph to React Flow format with dagre layout
  const { initialNodes, initialEdges } = useMemo<{
    initialNodes: Node[]
    initialEdges: Edge[]
  }>(() => {
    if (!currentGraph) {
      return { initialNodes: [], initialEdges: [] }
    }

    // Build map of existing positions from stored nodes
    const existingPositions = new Map<string, { x: number; y: number }>()
    currentGraph.nodes.forEach((node) => {
      if (node.position) {
        existingPositions.set(node.id, node.position)
      }
    })

    // Filter nodes based on focus mode
    const filteredNodes = Array.from(currentGraph.nodes.values()).filter((node) =>
      visibleNodeIds.has(node.id)
    )

    // Create nodes from knowledge nodes
    const nodes: Node[] = filteredNodes.map((node) => ({
      id: node.id,
      type: 'knowledgeNode',
      position: node.position || { x: 0, y: 0 },
      data: {
        knowledgeNode: { ...node, expanded: expandedNodeIds.has(node.id) },
        onExpand: handleExpandNode,
        onDeepen: handleDeepenNode,
        onRetry: handleExpandNode,
        onSelect: selectNode,
        onEdit: setEditingNodeId,
        selected: selectedNodeId === node.id,
        isLoading: loadingNodes.has(node.id),
        isDeepenLoading: loadingDeepenNodes.has(node.id),
      },
    }))

    // Filter edges to only show edges between visible nodes
    const filteredEdges = currentGraph.edges.filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    )

    // Create edges from knowledge edges
    const edges: Edge[] = filteredEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'custom',
      data: {
        type: edge.type,
        label: edge.label,
      },
      animated: edge.type === 'prerequisite',
      style: {
        strokeWidth: edge.weight ? edge.weight * 2 + 1 : 2,
      },
    }))

    // Apply dagre layout only for nodes without positions
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      existingPositions
    )

    return { initialNodes: layoutedNodes, initialEdges: layoutedEdges }
  }, [currentGraph, expandedNodeIds, selectedNodeId, loadingNodes, loadingDeepenNodes, visibleNodeIds, selectNode, handleExpandNode, handleDeepenNode])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Update nodes when initialNodes change
  useEffect(() => {
    setNodes(initialNodes)
  }, [initialNodes, setNodes])

  // fitView 只在结构签名变化时触发（通过 handleRelayout）
  // 不再在每次 initialNodes 变化时自动 fitView

  // Update edges when initialEdges change
  useEffect(() => {
    setEdges(initialEdges)
  }, [initialEdges, setEdges])

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  // Save node position when drag ends
  const onNodeDragStop = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      if (!currentGraph || !node.position) return

      // Update position in store
      updateNode(node.id, { position: node.position })

      // Save to IndexedDB
      try {
        const updatedGraph = useKnowledgeStore.getState().currentGraph
        if (updatedGraph) {
          await GraphRepository.save(updatedGraph)
        }
      } catch (error) {
        console.error('Failed to save node position:', error)
      }
    },
    [currentGraph, updateNode]
  )

  // 重新布局所有节点
  const handleRelayout = useCallback(() => {
    if (!currentGraph) return

    // 清除所有节点位置，触发重新布局
    currentGraph.nodes.forEach((node) => {
      updateNode(node.id, { position: undefined })
    })
  }, [currentGraph, updateNode])

  // 结构签名跟踪（用于判断是否需要重新布局）
  const lastStructureSignatureRef = useRef<string>('')

  // 自动布局：监听图谱更新事件
  useEffect(() => {
    if (!autoLayout) return

    const handleGraphUpdate = (event: GraphUpdateEvent) => {
      const detail: GraphUpdateEventDetail | undefined = event.detail
      // 跳过无 detail 的事件（来自 GraphRepository.save 的列表刷新通知）
      if (!detail) return

      // 只响应当前图谱的结构变更
      if (detail.graphId !== currentGraph?.id) return
      if (detail.mutationType !== 'structure') {
        console.log('[KnowledgeGraph] Content/meta update, skipping layout')
        return
      }

      // 计算当前结构签名
      const currentSignature = computeStructureSignature(
        Array.from(currentGraph.nodes.keys()),
        currentGraph.edges.map(e => ({ source: e.source, target: e.target, type: e.type }))
      )

      // 签名未变，跳过布局
      if (currentSignature === lastStructureSignatureRef.current) {
        console.log('[KnowledgeGraph] Structure signature unchanged, skipping layout')
        return
      }

      console.log('[KnowledgeGraph] Structure changed, triggering auto layout', {
        sourceOperationId: detail.sourceOperationId,
        hasNewNodes: detail.hasNewNodes,
        hasNewEdges: detail.hasNewEdges,
      })

      lastStructureSignatureRef.current = currentSignature
      handleRelayout()
    }

    window.addEventListener('graph-updated', handleGraphUpdate as EventListener)
    return () => window.removeEventListener('graph-updated', handleGraphUpdate as EventListener)
  }, [autoLayout, handleRelayout, currentGraph])

  // 保存节点编辑
  const handleSaveNode = useCallback(
    async (updates: Partial<KnowledgeNode>) => {
      if (!editingNodeId) return
      updateNode(editingNodeId, updates)
      setEditingNodeId(null)

      // Save to IndexedDB
      try {
        const updatedGraph = useKnowledgeStore.getState().currentGraph
        if (updatedGraph) {
          await GraphRepository.save(updatedGraph)
        }
      } catch (error) {
        console.error('Failed to save node:', error)
      }
    },
    [editingNodeId, updateNode]
  )

  if (!currentGraph || currentGraph.nodes.size === 0) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-muted-foreground">
            <p className="text-lg mb-2">知识图谱为空</p>
            <p className="text-sm">请输入一个知识点开始学习</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={{
          animated: false,
        }}
      >
        <Background />
        <Controls />
        <Panel position="top-left">
          <div className="bg-background/90 backdrop-blur border rounded-lg p-3 text-sm space-y-3">
            <div>
              <h3 className="font-medium mb-1">知识图谱</h3>
              <p className="text-muted-foreground text-xs">
                {focusMode && selectedNodeId
                  ? `聚焦视图 · ${visibleNodeIds.size} 个节点`
                  : `${currentGraph.nodes.size} 个知识点 · ${currentGraph.edges.length} 个关系`}
              </p>
            </div>
            {/* View mode toggle */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <button
                onClick={() => setFocusMode(false)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 text-xs rounded border transition-colors',
                  !focusMode
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                )}
                title="显示全部节点"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>全局</span>
              </button>
              <button
                onClick={() => setFocusMode(true)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 text-xs rounded border transition-colors',
                  focusMode
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
                  !selectedNodeId && 'opacity-50 cursor-not-allowed'
                )}
                title={selectedNodeId ? '聚焦选中节点' : '请先选择一个节点'}
                disabled={!selectedNodeId}
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                </svg>
                <span>聚焦</span>
              </button>
              {focusMode && (
                <div className="flex items-center gap-1 ml-1">
                  <span className="text-xs text-muted-foreground">深度</span>
                  {[1, 2, 3].map((depth) => (
                    <button
                      key={depth}
                      onClick={() => useKnowledgeStore.getState().setFocusDepth(depth)}
                      className={cn(
                        'w-5 h-5 text-xs rounded transition-colors',
                        useKnowledgeStore.getState().focusDepth === depth
                          ? 'bg-primary/20 text-primary font-medium'
                          : 'hover:bg-muted text-muted-foreground'
                      )}
                    >
                      {depth}
                    </button>
                  ))}
                </div>
              )}
              {/* 重新布局按钮 */}
              <button
                onClick={handleRelayout}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-auto"
                title="重新组织图谱布局"
              >
                <RefreshCw className="h-3 w-3" />
                <span>重新布局</span>
              </button>
            </div>
          </div>
        </Panel>
        {/* 图例 */}
        <Panel position="bottom-right">
          <div className="bg-background/90 backdrop-blur border rounded-lg p-3 text-xs">
            <h4 className="font-medium mb-2 text-muted-foreground">关系图例</h4>
            <div className="space-y-1.5">
              {edgeLegend.map((item) => (
                <div key={item.type} className="flex items-center gap-2">
                  <div className={`w-4 h-0.5 ${item.color}`} />
                  <span className="text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </ReactFlow>

      {/* 节点编辑弹窗 */}
      {editingNode && (
        <NodeEditDialog
          key={editingNode.id}
          node={editingNode}
          isOpen={true}
          onClose={() => setEditingNodeId(null)}
          onSave={handleSaveNode}
        />
      )}
    </div>
  )
}
