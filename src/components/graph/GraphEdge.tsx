import { getBezierPath, type EdgeProps } from 'reactflow'
import { cn } from '@/lib/utils'
import { edgeStyles } from './edgeConfig'

interface GraphEdgeData {
  type?: string
  label?: string
}

export function GraphEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  style,
}: EdgeProps<GraphEdgeData>) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const edgeType = (data?.type as keyof typeof edgeStyles) || 'related'
  const colorClass = edgeStyles[edgeType]

  return (
    <path
      id={id}
      d={edgePath}
      className={cn(
        'fill-none stroke-2 transition-colors',
        colorClass,
        selected && 'stroke-[3px]'
      )}
      style={style}
    />
  )
}
