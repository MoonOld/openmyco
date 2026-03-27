// OpenAI Compatible API configuration
export interface LLMConfig {
  baseURL: string
  apiKey: string
  model: string
  temperature?: number
  maxTokens?: number
  /** API endpoint path (e.g., 'chat/completions', 'chat/responses'). If not specified, will auto-detect. */
  endpoint?: string
}

// Chat message type
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// API response type
export interface LLMResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

// Stream chunk type
export interface LLMStreamChunk {
  content: string
  done: boolean
}

// OpenAI API response format
export interface OpenAIChatResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// Default LLM configuration
export const DEFAULT_LLM_CONFIG: Omit<LLMConfig, 'apiKey'> = {
  baseURL: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 4000,
}
