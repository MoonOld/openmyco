import type { RelationType } from '@/types'

export const RELATION_CONFIGS: Record<
  RelationType,
  { color: string; label: string; description: string }
> = {
  prerequisite: {
    color: '#ef4444',
    label: '前置知识',
    description: '学习当前知识前需要掌握的内容',
  },
  postrequisite: {
    color: '#22c55e',
    label: '后置知识',
    description: '学习当前知识后可以继续学习的内容',
  },
  related: {
    color: '#3b82f6',
    label: '相关知识',
    description: '与当前知识有关联的内容',
  },
  contains: {
    color: '#f97316',
    label: '包含',
    description: '当前知识包含的内容',
  },
  depends: {
    color: '#a855f7',
    label: '依赖',
    description: '当前知识依赖的其他内容',
  },
}

export const NODE_TYPE_CONFIGS: Record<
  string,
  { label: string; description: string; icon: string }
> = {
  concept: {
    label: '概念',
    description: '抽象的概念或原理',
    icon: 'lightbulb',
  },
  skill: {
    label: '技能',
    description: '可操作的技能或能力',
    icon: 'book',
  },
  tool: {
    label: '工具',
    description: '使用的工具、框架或库',
    icon: 'wrench',
  },
  theory: {
    label: '理论',
    description: '理论知识或原理',
    icon: 'code',
  },
}

export const GRAPH_LAYOUTS = {
  FORCE_DIRECTED: 'force-directed',
  HIERARCHICAL: 'hierarchical',
  CIRCULAR: 'circular',
  ORGANIC: 'organic',
} as const

export const DEFAULT_GRAPH_CONFIG = {
  minZoom: 0.2,
  maxZoom: 2,
  defaultNodeWidth: 200,
  defaultNodeHeight: 120,
  nodeSpacing: 100,
}
