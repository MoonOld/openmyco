import { useEffect, useState, useCallback, useRef } from 'react'
import { History, Trash2, Clock, AlertTriangle, Plus } from 'lucide-react'
import { Button } from '@/components/ui'
import { GraphRepository, storedToRuntime, resetDB } from '@/lib/storage'
import { useKnowledgeStore } from '@/stores'
import { formatDate } from '@/lib/utils'

interface GraphSummary {
  id: string
  name: string
  updatedAt: Date
}

export function Sidebar({ className }: { className?: string }) {
  const [graphs, setGraphs] = useState<GraphSummary[]>([])
  const { setCurrentGraph, clearGraph, currentGraph, createEmptyGraph } = useKnowledgeStore()
  const isLoadingRef = useRef(false)

  // Load graphs from storage
  const loadGraphs = useCallback(async () => {
    // 防止重复加载
    if (isLoadingRef.current) return
    isLoadingRef.current = true

    try {
      const allGraphs = await GraphRepository.getAll()
      const summaries: GraphSummary[] = allGraphs.map((g) => ({
        id: g.id,
        name: g.name,
        updatedAt: new Date(g.updatedAt),
      }))
      summaries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      setGraphs(summaries)
    } catch (error) {
      console.error('Failed to load graphs:', error)
    } finally {
      isLoadingRef.current = false
    }
  }, [])

  // 初始加载
  useEffect(() => {
    void loadGraphs()
  }, [loadGraphs])

  // 监听图谱更新事件
  useEffect(() => {
    const handleGraphUpdate = () => {
      void loadGraphs()
    }
    window.addEventListener('graph-updated', handleGraphUpdate)
    return () => {
      window.removeEventListener('graph-updated', handleGraphUpdate)
    }
  }, [loadGraphs])

  // 新建空图谱
  const handleNewGraph = async () => {
    createEmptyGraph()
    // 保存到 IndexedDB 并刷新列表
    const { currentGraph } = useKnowledgeStore.getState()
    if (currentGraph) {
      await GraphRepository.save(currentGraph)
      await loadGraphs()
    }
  }

  const handleSelectGraph = async (id: string) => {
    try {
      const stored = await GraphRepository.getById(id)
      if (stored) {
        const graph = storedToRuntime(stored)
        setCurrentGraph(graph)
      }
    } catch (error) {
      console.error('Failed to load graph:', error)
    }
  }

  // Delete a single graph - 使用异步操作避免 UI 阻塞
  const handleDeleteGraph = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()

    // 确认删除
    const confirmed = window.confirm('确定要删除这个图谱吗？此操作不可撤销。')
    if (!confirmed) return

    // 先记录是否是当前图谱
    const isCurrentGraph = currentGraph?.id === id

    // 异步执行删除
    try {
      await GraphRepository.delete(id)

      // 如果是当前图谱，先清除 UI 状态
      if (isCurrentGraph) {
        clearGraph()
      }

      // 然后刷新列表
      await loadGraphs()
    } catch (error) {
      console.error('Failed to delete graph:', error)
    }
  }

  // Reset all data
  const handleResetAll = async () => {
    // 确认删除全部数据
    const confirmed = window.confirm('确定要删除所有数据吗？此操作不可撤销，所有图谱都将被清空！')
    if (!confirmed) return

    try {
      await resetDB()
      clearGraph()
      await loadGraphs()
    } catch (error) {
      console.error('Failed to reset database:', error)
    }
  }

  return (
    <aside className={className}>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-3">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">历史图谱</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {graphs.length} 个
            </span>
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            <Button
              variant="default"
              size="sm"
              className="w-full"
              onClick={handleNewGraph}
            >
              <Plus className="h-3 w-3 mr-1" />
              新建图谱
            </Button>
            {currentGraph && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-destructive hover:text-destructive"
                onClick={() => handleDeleteGraph(currentGraph.id)}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                删除当前图谱
              </Button>
            )}
            {graphs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground hover:text-destructive"
                onClick={handleResetAll}
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                清除所有数据
              </Button>
            )}
          </div>
        </div>

        {/* Graph list */}
        <div className="flex-1 overflow-y-auto p-2">
          {graphs.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              <p>暂无历史图谱</p>
              <p className="text-xs mt-1">点击上方按钮创建第一个图谱</p>
            </div>
          ) : (
            <div className="space-y-2">
              {graphs.map((graph) => (
                <button
                  key={graph.id}
                  onClick={() => handleSelectGraph(graph.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors hover:bg-accent group ${
                    currentGraph?.id === graph.id
                      ? 'bg-accent border-primary'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{graph.name}</p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDate(graph.updatedAt)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteGraph(graph.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
                      title="删除图谱"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
