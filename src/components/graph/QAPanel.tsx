import { useState } from 'react'
import { useKnowledgeStore } from '@/stores'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import type { QAActionType, MergeableField } from '@/types'

const FIELD_LABELS: Record<MergeableField, string> = {
  principle: '核心原理',
  useCases: '应用场景',
  bestPractices: '最佳实践',
  commonMistakes: '常见错误',
}

const ACTION_LABELS: Record<QAActionType, string> = {
  save_only: '仅保存',
  merge_to_field: '合并到字段',
  generate_subtopic: '生成子话题',
  upgrade_to_node: '升级为节点',
}

export function QAPanel({ nodeId }: { nodeId: string }) {
  const [question, setQuestion] = useState('')
  const [selectedAction, setSelectedAction] = useState<QAActionType | null>(null)

  const { currentGraph, qaLoadingNodes, qaError, askQuestion, executeQAAction, setQaError } = useKnowledgeStore()

  const node = currentGraph?.nodes.get(nodeId)
  const isLoading = qaLoadingNodes.has(nodeId)

  // Pending QAs: action result not yet set
  const pendingQAs = node?.qas?.filter(qa => !qa.actionResult) || []
  // History QAs: action result set
  const historyQAs = node?.qas?.filter(qa => !!qa.actionResult) || []

  const canSubmit = question.trim().length > 0 && !isLoading

  const handleSubmit = async () => {
    if (!canSubmit) return
    await askQuestion(nodeId, question.trim())
    setQuestion('')
  }

  const handleAction = (qaId: string, action: QAActionType) => {
    if (action === 'merge_to_field') {
      // Need to select a field first
      setSelectedAction(action)
      return
    }
    executeQAAction(nodeId, qaId, action)
  }

  const handleFieldSelect = (qaId: string, field: MergeableField) => {
    executeQAAction(nodeId, qaId, 'merge_to_field', field)
    setSelectedAction(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="space-y-4">
      {/* Question input */}
      <div className="space-y-2">
        <Textarea
          placeholder="输入你的问题..."
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value)
            if (qaError) setQaError(null)
          }}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          rows={2}
          className="resize-none"
        />
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          size="sm"
          className="w-full"
        >
          {isLoading ? '思考中...' : '提问'}
        </Button>
      </div>

      {/* Error state */}
      {qaError && (
        <div className="text-sm text-destructive bg-destructive/10 rounded p-2">
          {qaError}
        </div>
      )}

      {/* Pending QAs - awaiting action */}
      {pendingQAs.map(qa => (
        <div key={qa.id} className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="text-sm font-medium">{qa.question}</div>
          <div className="text-sm text-muted-foreground">{qa.answer}</div>
          <div className="text-xs text-muted-foreground">
            建议: {ACTION_LABELS[qa.action] || qa.action}
            {qa.mergedField && ` → ${FIELD_LABELS[qa.mergedField]}`}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction(qa.id, 'save_only')}
            >
              仅保存
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction(qa.id, 'merge_to_field')}
            >
              合并到字段
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction(qa.id, 'generate_subtopic')}
            >
              生成子话题
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction(qa.id, 'upgrade_to_node')}
            >
              升级为节点
            </Button>
          </div>

          {/* Field selection for merge_to_field */}
          {selectedAction === 'merge_to_field' && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(Object.keys(FIELD_LABELS) as MergeableField[]).map(field => (
                <Button
                  key={field}
                  variant="secondary"
                  size="sm"
                  onClick={() => handleFieldSelect(qa.id, field)}
                >
                  {FIELD_LABELS[field]}
                </Button>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* History QAs */}
      {historyQAs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">历史问答</h4>
          {historyQAs.map(qa => (
            <details key={qa.id} className="rounded-lg border bg-muted/20">
              <summary className="px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                {qa.question}
              </summary>
              <div className="px-3 pb-2 space-y-1">
                <p className="text-sm text-muted-foreground">{qa.answer}</p>
                <p className="text-xs text-muted-foreground">
                  动作: {qa.actionResult}
                </p>
              </div>
            </details>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !qaError && pendingQAs.length === 0 && historyQAs.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-4">
          对这个知识点提问，深入探索
        </div>
      )}
    </div>
  )
}
