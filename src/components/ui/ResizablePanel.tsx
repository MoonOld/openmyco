import { useState, useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { PanelRightClose, PanelRight } from 'lucide-react'
import { Button } from './button'

interface ResizablePanelProps {
  children: React.ReactNode
  className?: string
  width: number
  minWidth?: number
  maxWidth?: number
  collapsed: boolean
  onWidthChange: (width: number) => void
  onToggle: () => void
  side?: 'left' | 'right'
  showToggle?: boolean
}

export function ResizablePanel({
  children,
  className,
  width,
  minWidth = 240,
  maxWidth = 600,
  collapsed,
  onWidthChange,
  onToggle,
  side = 'right',
  showToggle = true,
}: ResizablePanelProps) {
  const [isResizing, setIsResizing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      const newWidth = side === 'right'
        ? window.innerWidth - e.clientX
        : e.clientX

      onWidthChange(Math.max(minWidth, Math.min(maxWidth, newWidth)))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, minWidth, maxWidth, onWidthChange, side])

  if (collapsed) {
    return (
      <div className={cn(
        "flex flex-col border-l bg-background/95 backdrop-blur transition-all duration-200",
        side === 'right' ? 'border-l' : 'border-r',
        className
      )}>
        {/* 展开按钮 */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="m-2"
          title="展开面板"
        >
          <PanelRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div
      ref={panelRef}
      className={cn(
        "relative flex flex-col bg-background/95 backdrop-blur overflow-hidden transition-colors",
        side === 'right' ? 'border-l' : 'border-r',
        isResizing && 'select-none',
        className
      )}
      style={{ width: `${width}px` }}
    >
      {/* 折叠按钮 */}
      {showToggle && (
        <div className="absolute top-2 right-2 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-7 w-7"
            title="折叠面板"
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </div>

      {/* 拖拽调整宽度的手柄 */}
      <div
        className={cn(
          "absolute top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors z-20",
          side === 'right' ? 'left-0' : 'right-0',
          isResizing && 'bg-primary/50'
        )}
        onMouseDown={handleMouseDown}
      />
    </div>
  )
}
