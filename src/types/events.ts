/**
 * 图谱更新事件类型定义
 */

export type GraphMutationType = 'structure' | 'content' | 'meta'

export interface GraphUpdateEventDetail {
  graphId: string
  mutationType: GraphMutationType
  hasNewNodes?: boolean
  hasNewEdges?: boolean
  sourceOperationId?: string
  timestamp: number
}

export type GraphUpdateEvent = CustomEvent<GraphUpdateEventDetail>

/**
 * 触发图谱更新事件
 */
export function dispatchGraphUpdateEvent(detail: GraphUpdateEventDetail): void {
  window.dispatchEvent(
    new CustomEvent<GraphUpdateEventDetail>('graph-updated', { detail })
  )
}

/**
 * 计算图谱结构签名（用于判断是否需要重新布局）
 * 只包含节点 ID 和边的 source-target-type
 */
export function computeStructureSignature(
  nodeIds: string[],
  edges: Array<{ source: string; target: string; type: string }>
): string {
  const sortedNodeIds = [...nodeIds].sort()
  const sortedEdges = edges
    .map((e) => `${e.source}-${e.target}-${e.type}`)
    .sort()

  return `nodes:[${sortedNodeIds.join(',')}]|edges:[${sortedEdges.join(',')}]`
}
