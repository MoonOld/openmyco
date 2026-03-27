import { useReactFlow } from 'reactflow'
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui'

export function GraphControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  const handleZoomIn = () => {
    zoomIn({ duration: 300 })
  }

  const handleZoomOut = () => {
    zoomOut({ duration: 300 })
  }

  const handleFitView = () => {
    fitView({ duration: 300, padding: 0.2 })
  }

  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={handleZoomIn}
        title="放大"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={handleZoomOut}
        title="缩小"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={handleFitView}
        title="适应视图"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
