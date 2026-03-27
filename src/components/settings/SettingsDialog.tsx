import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import { Button, Input, Label } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useSettingsStore, useUIStore } from '@/stores'
import { DEFAULT_LLM_CONFIG } from '@/types'
import { createLLMClient } from '@/lib/llm'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

type OptionalNumberInputProps = {
  id: string
  label: string
  value: number | undefined
  min: number
  max: number
  step: number
  placeholder: string
  onChange: (value: number | undefined) => void
}

function OptionalNumberInput({
  id,
  label,
  value,
  min,
  max,
  step,
  placeholder,
  onChange,
}: OptionalNumberInputProps) {
  const enabled = value !== undefined
  const inputValue = value?.toString() ?? ''

  const handleEnabledChange = (checked: boolean) => {
    if (!checked) {
      onChange(undefined)
    } else {
      const defaultValue = label === 'Temperature' ? 0.7 : 4000
      onChange(defaultValue)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseFloat(e.target.value)
    if (!isNaN(num)) {
      onChange(num)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={`${id}-enabled`}
          checked={enabled}
          onChange={(e) => handleEnabledChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor={`${id}-enabled`} className="text-sm font-normal">
          {label}
        </Label>
      </div>
      {enabled && (
        <Input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="mt-1"
        />
      )}
    </div>
  )
}

type TestStatus = 'idle' | 'loading' | 'success' | 'error'

interface TestResult {
  success: boolean
  message: string
  details?: string
  hint?: string
  responseBody?: string
}

export function SettingsDialog() {
  const { settingsDialogOpen, setSettingsDialogOpen } = useUIStore()
  const { llmConfig, setLLMConfig, resetSettings } = useSettingsStore()

  const [localConfig, setLocalConfig] = useState(llmConfig)
  const [showApiKey, setShowApiKey] = useState(false)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  // Reset state when dialog opens
  useEffect(() => {
    if (settingsDialogOpen) {
      setTestStatus('idle')
      setTestResult(null)
    }
  }, [settingsDialogOpen])

  // Update local config when store changes
  useEffect(() => {
    setLocalConfig(llmConfig)
  }, [llmConfig])

  const handleSave = () => {
    setLLMConfig(localConfig)
    setSettingsDialogOpen(false)
  }

  const handleCancel = () => {
    setLocalConfig(llmConfig)
    setSettingsDialogOpen(false)
  }

  const handleReset = () => {
    if (confirm('确定要重置所有设置吗？')) {
      resetSettings()
      setLocalConfig({
        ...DEFAULT_LLM_CONFIG,
        apiKey: '',
      })
      setSettingsDialogOpen(false)
      setTestStatus('idle')
      setTestResult(null)
    }
  }

  const handleTestConnection = async () => {
    if (!localConfig.apiKey) {
      setTestResult({
        success: false,
        message: '请先输入 API Key',
      })
      setTestStatus('error')
      return
    }

    setTestStatus('loading')
    setTestResult(null)

    try {
      const client = createLLMClient(localConfig)
      const result = await client.testConnection()

      if (result.success) {
        setTestResult({
          success: true,
          message: `✅ 连接成功！响应时间: ${result.responseTime}ms`,
          details: result.content ? `模型回复: "${result.content}"` : undefined,
        })
        setTestStatus('success')
      } else {
        // Format detailed error message
        let errorMsg = `❌ ${result.error}`

        if (result.httpStatus) {
          const hint = getErrorHint(result.httpStatus)
          if (hint) {
            errorMsg += `\n\n💡 ${hint}`
          }
        }

        // Show response body if available (for debugging)
        if (result.responseBody && result.responseBody.length < 500) {
          errorMsg += `\n\n响应内容:\n${result.responseBody}`
        }

        setTestResult({
          success: false,
          message: errorMsg,
          hint: result.httpStatus ? getErrorHint(result.httpStatus) : undefined,
          responseBody: result.responseBody,
        })
        setTestStatus('error')
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `❌ 连接失败: ${error instanceof Error ? error.message : '未知错误'}`,
      })
      setTestStatus('error')
    }
  }

  function getErrorHint(status: number): string {
    const hints: Record<number, string> = {
      400: '请求格式错误，可能是模型名称不正确',
      401: 'API Key 无效或未提供',
      403: 'API Key 没有权限，或账户余额不足/配额用完',
      404: 'API 端点不存在，请检查 Base URL',
      429: '请求频率超限，请稍后重试',
      500: '服务器内部错误，请稍后重试',
      503: '服务暂时不可用',
    }
    return hints[status] || ''
  }

  return (
    <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>
            配置 API 和应用偏好设置
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* API Configuration */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">API 配置</h3>

            <div className="space-y-2">
              <Label htmlFor="base-url">Base URL</Label>
              <Input
                id="base-url"
                value={localConfig.baseURL}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, baseURL: e.target.value })
                }
                placeholder="https://api.openai.com/v1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="api-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={localConfig.apiKey}
                  onChange={(e) => {
                    setLocalConfig({ ...localConfig, apiKey: e.target.value })
                    // Reset test status when config changes
                    if (testStatus !== 'idle') setTestStatus('idle')
                  }}
                  placeholder="sk-..."
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                  title={showApiKey ? '隐藏' : '显示'}
                >
                  {showApiKey ? '🙈' : '👁️'}
                </Button>
              </div>
            </div>

            {/* Test Connection Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleTestConnection}
              disabled={testStatus === 'loading' || !localConfig.apiKey}
            >
              {testStatus === 'loading' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {testStatus === 'loading' && '测试连接中...'}
              {testStatus === 'idle' && '测试 API 连接'}
              {testStatus === 'success' && (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                  连接成功
                </>
              )}
              {testStatus === 'error' && (
                <>
                  <XCircle className="mr-2 h-4 w-4 text-red-600" />
                  连接失败
                </>
              )}
            </Button>

            {/* Test Result Message */}
            {testResult && (
              <div className={cn(
                'text-sm p-2 rounded whitespace-pre-line',
                testResult.success ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'
              )}>
                {testResult.message}
                {testResult.hint && (
                  <div className="mt-1 pt-1 border-t border-current/20 text-xs opacity-80">
                    {testResult.hint}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="model">模型</Label>
              <Input
                id="model"
                value={localConfig.model}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, model: e.target.value })
                }
                placeholder="gpt-4o-mini"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <OptionalNumberInput
                id="temperature"
                label="Temperature"
                value={localConfig.temperature}
                min={0}
                max={2}
                step={0.1}
                placeholder="0.7"
                onChange={(value) =>
                  setLocalConfig({ ...localConfig, temperature: value })
                }
              />

              <OptionalNumberInput
                id="max-tokens"
                label="Max Tokens"
                value={localConfig.maxTokens}
                min={1}
                max={100000}
                step={1}
                placeholder="4000"
                onChange={(value) =>
                  setLocalConfig({ ...localConfig, maxTokens: value })
                }
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleReset}>
            重置
          </Button>
          <Button variant="outline" onClick={handleCancel}>
            取消
          </Button>
          <Button onClick={handleSave}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
