import { MessageSquare } from 'lucide-react'
import { ChatInput } from './ChatInput'
import { KnowledgeGraph } from '@/components/graph'
import { NodeDetailPanel } from '@/components/graph'
import { useKnowledgeStore, useSettingsStore } from '@/stores'
import { ResizablePanel } from '@/components/ui'

export function ChatInterface() {
  const { currentGraph } = useKnowledgeStore()
  const {
    detailPanelCollapsed,
    detailPanelWidth,
    toggleDetailPanel,
    setDetailPanelWidth,
  } = useSettingsStore()

  return (
    <div className="h-full flex flex-col">
      {/* Input area */}
      <div className="flex-shrink-0 p-4 border-b bg-background/95 backdrop-blur">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">
              {currentGraph ? '继续探索' : '开始学习'}
            </h2>
          </div>
          <ChatInput />
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Graph visualization */}
        <div className="flex-1 relative">
          <KnowledgeGraph className="w-full h-full" />
        </div>

        {/* Node detail panel - resizable and collapsible */}
        <ResizablePanel
          width={detailPanelWidth}
          collapsed={detailPanelCollapsed}
          onWidthChange={setDetailPanelWidth}
          onToggle={toggleDetailPanel}
          minWidth={280}
          maxWidth={500}
          side="right"
          className="h-full"
        >
          <NodeDetailPanel className="p-4 pt-12" />
        </ResizablePanel>
      </div>
    </div>
  )
}
