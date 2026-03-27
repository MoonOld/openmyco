export const DEFAULT_PROMPTS = {
  system: '你是一个专业的知识图谱构建助手。',
  topics: [
    'React Hooks',
    'TypeScript',
    '机器学习',
    '数据结构',
    '算法',
    '前端开发',
    '后端开发',
    '数据库',
    '计算机网络',
    '操作系统',
  ],
}

export const EXAMPLE_TOPICS = [
  { title: 'React Hooks', description: 'React 的函数组件特性' },
  { title: 'TypeScript', description: 'JavaScript 的超集' },
  { title: '机器学习', description: '人工智能的核心技术' },
  { title: '数据结构', description: '计算机科学的基础' },
  { title: '算法', description: '解决问题的方法和步骤' },
]

export const LLM_ERROR_MESSAGES = {
  NO_API_KEY: '请先配置 API Key',
  API_ERROR: 'API 请求失败，请检查配置',
  PARSE_ERROR: '解析响应失败，请重试',
  TIMEOUT: '请求超时，请重试',
  NETWORK_ERROR: '网络错误，请检查连接',
}

export const STREAM_CHUNK_SIZE = 100 // ms
