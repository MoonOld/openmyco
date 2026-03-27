/**
 * API 连接测试脚本
 *
 * 使用环境变量测试真实的 LLM API 连接
 *
 * 环境变量:
 *   OPENAI_API_KEY - API 密钥
 *   OPENAI_BASE_URL - API 基础 URL (可选，默认 https://api.openai.com/v1)
 *   OPENAI_MODEL - 模型名称 (可选，默认 gpt-4o-mini)
 *   OPENAI_ENDPOINT - API 端点路径 (可选，默认自动探测)
 *                    支持的端点: chat/completions, chat/responses
 *
 * 运行方式:
 *   OPENAI_API_KEY=sk-xxx OPENAI_BASE_URL=https://api.openai.com/v1 node --test ./test-api.ts
 *   或者创建 .env 文件后运行
 */

import { request } from 'undici'

const API_KEY = process.env.OPENAI_API_KEY || ''
const BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
const MODEL = process.env.OPENAI_MODEL || 'codex-mini-latest'
// 支持的端点列表，按优先级排序
const POSSIBLE_ENDPOINTS = ['chat/completions', 'chat/responses']
const USER_ENDPOINT = process.env.OPENAI_ENDPOINT || ''

interface TestResult {
  success: boolean
  message: string
  details?: {
    model: string
    baseURL: string
    endpoint: string
    responseTime: number
  }
  error?: {
    status?: number
    statusText?: string
    body?: string
  }
}

async function tryEndpoint(
  baseURL: string,
  endpoint: string,
  apiKey: string,
  model: string
): Promise<{ success: boolean; statusCode: number; responseText: string; responseTime: number }> {
  const startTime = Date.now()
  const requestBody = {
    model,
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Say "OK" if you can receive this message.' },
    ],
    max_tokens: 10,
  }

  try {
    const { body, statusCode } = await request(`${baseURL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    const responseText = await body.text()
    const responseTime = Date.now() - startTime

    return {
      success: statusCode === 200 && responseText.trim().startsWith('{'),
      statusCode,
      responseText,
      responseTime,
    }
  } catch {
    return {
      success: false,
      statusCode: 0,
      responseText: '',
      responseTime: Date.now() - startTime,
    }
  }
}

async function testConnection(): Promise<TestResult> {
  if (!API_KEY) {
    return {
      success: false,
      message: '❌ 缺少 OPENAI_API_KEY 环境变量',
      error: {
        body: '请设置 OPENAI_API_KEY=sk-xxx',
      },
    }
  }

  console.log('🔍 测试 LLM API 连接...\n')
  console.log(`   Base URL: ${BASE_URL}`)
  console.log(`   Model: ${MODEL}`)
  console.log(`   API Key: ${API_KEY.slice(0, 8)}...${API_KEY.slice(-4)}`)

  // 如果用户指定了端点，只测试该端点
  const endpointsToTry = USER_ENDPOINT
    ? [USER_ENDPOINT]
    : POSSIBLE_ENDPOINTS

  console.log(`   端点探测: ${USER_ENDPOINT ? '用户指定' : '自动'}`)

  console.log('')

  for (const endpoint of endpointsToTry) {
    console.log(`→ 尝试端点: /${endpoint}`)

    const result = await tryEndpoint(BASE_URL, endpoint, API_KEY, MODEL)

    console.log(`   状态: ${result.statusCode}, 响应时间: ${result.responseTime}ms`)

    if (result.success) {
      const data = JSON.parse(result.responseText) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const content = data.choices?.[0]?.message?.content || ''

      console.log('\n--- 响应内容 ---')
      console.log(`模型回复: "${content.trim()}"`)
      console.log('----------------')

      return {
        success: true,
        message: `✅ API 连接成功！(端点: /${endpoint})`,
        details: {
          model: MODEL,
          baseURL: BASE_URL,
          endpoint,
          responseTime: result.responseTime,
        },
      }
    }

    // 如果是最后一个端点或者用户指定了端点，显示错误详情
    if (endpoint === endpointsToTry[endpointsToTry.length - 1]) {
      console.log('\n❌ 所有端点尝试失败')
      console.log('--- 错误详情 ---')
      console.log(`HTTP Status: ${result.statusCode}`)
      console.log(`Response Body:\n${result.responseText.slice(0, 500)}`)
      console.log('----------------')

      const hints: Record<number, string> = {
        400: '请求格式错误，可能是模型名称不正确',
        401: 'API Key 无效或未提供',
        403: 'API Key 没有权限访问此模型，或账户配额已用完',
        404: 'API 端点不存在，检查 Base URL',
        429: '请求频率超限，请稍后重试',
        500: '服务器内部错误，请稍后重试',
        503: '服务暂时不可用',
      }

      const hint = hints[result.statusCode]
      if (hint) {
        console.log(`💡 提示: ${hint}`)
      }

      return {
        success: false,
        message: `❌ API 返回错误 (HTTP ${result.statusCode})`,
        error: {
          status: result.statusCode,
          statusText: String(result.statusCode),
          body: result.responseText.slice(0, 500),
        },
      }
    }

    console.log(`   失败，尝试下一个端点...\n`)
  }

  return {
    success: false,
    message: '❌ 未找到可用的 API 端点',
    error: {
      body: '已尝试: ' + endpointsToTry.join(', '),
    },
  }
}

// 运行测试
testConnection().then((result) => {
  if (!result.success) {
    console.log('\n测试失败\n')
  }

  if (result.success && result.details) {
    console.log(`\n✅ API 配置正确！`)
    console.log(`   响应时间: ${result.details.responseTime}ms`)
    console.log(`   基础 URL: ${result.details.baseURL}`)
    console.log(`   端点: /${result.details.endpoint}`)
    console.log(`   模型: ${result.details.model}\n`)
  }

  process.exit(result.success ? 0 : 1)
})
