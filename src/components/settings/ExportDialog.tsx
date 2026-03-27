import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import { Button, Textarea } from '@/components/ui'
import { useUIStore } from '@/stores'
import { useKnowledgeStore } from '@/stores'
import { exportGraphToJson } from '@/lib/storage'

export function ExportDialog() {
  const { exportDialogOpen, setExportDialogOpen } = useUIStore()
  const { currentGraph } = useKnowledgeStore()
  const [copied, setCopied] = useState(false)

  const exportJson = currentGraph ? exportGraphToJson(currentGraph) : '{}'

  const handleCopy = () => {
    navigator.clipboard.writeText(exportJson)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([exportJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `knowledge-graph-${currentGraph?.name || 'export'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>导出知识图谱</DialogTitle>
          <DialogDescription>
            导出当前知识图谱为 JSON 格式
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!currentGraph ? (
            <p className="text-muted-foreground text-center py-8">
              当前没有可导出的知识图谱
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">JSON 数据</label>
                <Textarea
                  value={exportJson}
                  readOnly
                  className="h-64 font-mono text-xs"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
            关闭
          </Button>
          {currentGraph && (
            <>
              <Button variant="outline" onClick={handleCopy}>
                {copied ? '已复制!' : '复制'}
              </Button>
              <Button onClick={handleDownload}>
                下载
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
