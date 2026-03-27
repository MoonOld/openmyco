import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import { Button, Input, Label } from '@/components/ui'
import { useUIStore, useKnowledgeStore } from '@/stores'
import { importGraphFromJson } from '@/lib/storage'

export function ImportDialog() {
  const { importDialogOpen, setImportDialogOpen } = useUIStore()
  const { setCurrentGraph } = useKnowledgeStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [jsonInput, setJsonInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setJsonInput(content)
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!jsonInput.trim()) {
      setError('请输入或粘贴 JSON 数据')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const result = await importGraphFromJson(jsonInput)

      if (result.success && result.graphId) {
        setSuccess(true)

        // Load the imported graph (data is already saved)
        const { GraphRepository, storedToRuntime } = await import('@/lib/storage')
        const stored = await GraphRepository.getById(result.graphId!)
        if (stored) {
          setCurrentGraph(storedToRuntime(stored))
        }

        setImportDialogOpen(false)
        setJsonInput('')
      } else {
        setError(result.error || '导入失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败')
    } finally {
      setLoading(false)
      setSuccess(false)
    }
  }

  const handleClose = () => {
    setImportDialogOpen(false)
    setJsonInput('')
    setError(null)
    setSuccess(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>导入知识图谱</DialogTitle>
          <DialogDescription>
            从 JSON 文件或文本导入知识图谱
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="file-input">从文件导入</Label>
            <Input
              id="file-input"
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleFileChange}
              disabled={loading}
            />
          </div>

          <div className="text-center text-sm text-muted-foreground">
            或
          </div>

          <div className="space-y-2">
            <Label htmlFor="json-input">粘贴 JSON 数据</Label>
            <textarea
              id="json-input"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='{"version": "1.0.0", "graph": {...}}'
              className="w-full h-32 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {success && (
            <p className="text-sm text-green-600">导入成功！</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleImport} disabled={!jsonInput.trim() || loading}>
            {loading ? '导入中...' : '导入'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
