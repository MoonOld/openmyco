import { Brain, Settings, Download, Upload, PanelLeft, PanelLeftClose, PanelRight, PanelRightClose } from 'lucide-react'
import { Button } from '@/components/ui'
import { useUIStore, useSettingsStore } from '@/stores'

export function Header() {
  const { setSettingsDialogOpen, setExportDialogOpen, setImportDialogOpen } = useUIStore()
  const { sidebarCollapsed, toggleSidebar, detailPanelCollapsed, toggleDetailPanel } = useSettingsStore()

  return (
    <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-full items-center justify-between px-4">
        {/* Left section: Toggle + Logo */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
          >
            {sidebarCollapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
          <Brain className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">OpenLearning</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Toggle detail panel */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDetailPanel}
            title={detailPanelCollapsed ? '展开详情面板' : '折叠详情面板'}
          >
            {detailPanelCollapsed ? (
              <PanelRight className="h-4 w-4" />
            ) : (
              <PanelRightClose className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setExportDialogOpen(true)}
            title="导出知识图谱"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setImportDialogOpen(true)}
            title="导入知识图谱"
          >
            <Upload className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsDialogOpen(true)}
            title="设置"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
