// 边颜色配置
export const edgeStyles = {
  prerequisite: 'stroke-red-500',
  postrequisite: 'stroke-green-500',
  related: 'stroke-blue-500',
  depends: 'stroke-purple-500',
  contains: 'stroke-orange-500',
}

// 图例数据
export const edgeLegend = [
  { type: 'prerequisite', label: '前置知识', color: 'bg-red-500' },
  { type: 'postrequisite', label: '后置知识', color: 'bg-green-500' },
  { type: 'related', label: '相关知识', color: 'bg-blue-500' },
  { type: 'depends', label: '依赖关系', color: 'bg-purple-500' },
  { type: 'contains', label: '包含关系', color: 'bg-orange-500' },
]
