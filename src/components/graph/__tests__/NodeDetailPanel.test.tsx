import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NodeDetailPanel } from '../NodeDetailPanel'
import type { KnowledgeNode, KnowledgeGraph } from '@/types'

// Mock the knowledge store
const mockSelectNode = vi.fn()
const mockSetFocusMode = vi.fn()
const mockAskQuestion = vi.fn()
const mockExecuteQAAction = vi.fn()


let mockCurrentGraph: KnowledgeGraph | null = null
let mockSelectedNodeId: string | null = null

vi.mock('@/stores', () => ({
  useKnowledgeStore: () => ({
    currentGraph: mockCurrentGraph,
    selectedNodeId: mockSelectedNodeId,
    selectNode: mockSelectNode,
    setFocusMode: mockSetFocusMode,
    qaLoadingNodes: new Set<string>(),
    qaError: null as string | null,
    askQuestion: mockAskQuestion,
    executeQAAction: mockExecuteQAAction,
    setQaError: vi.fn(),
  }),
}))

function createMockNode(overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id: 'node-1',
    title: 'React',
    description: 'A JavaScript library for building UIs',
    type: 'tool',
    difficulty: 3,
    estimatedTime: 30,
    tags: ['frontend', 'library'],
    expanded: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function createMockGraph(nodes: KnowledgeNode[] = [], edges: KnowledgeGraph['edges'] = []): KnowledgeGraph {
  return {
    id: 'graph-1',
    rootId: nodes[0]?.id || '',
    nodes: new Map(nodes.map((n) => [n.id, n])),
    edges,
    name: 'Test Graph',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('NodeDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCurrentGraph = null
    mockSelectedNodeId = null
  })

  describe('empty state', () => {
    it('should show placeholder when no node is selected', () => {
      render(<NodeDetailPanel />)
      expect(screen.getByText('选择一个节点查看详情')).toBeInTheDocument()
    })

    it('should show placeholder when graph is null', () => {
      mockSelectedNodeId = 'node-1'
      render(<NodeDetailPanel />)
      expect(screen.getByText('选择一个节点查看详情')).toBeInTheDocument()
    })
  })

  describe('node header', () => {
    it('should display node title and type', () => {
      const node = createMockNode()
      mockCurrentGraph = createMockGraph([node])
      mockSelectedNodeId = 'node-1'

      render(<NodeDetailPanel />)
      expect(screen.getByText('React')).toBeInTheDocument()
      expect(screen.getByText(/tool/)).toBeInTheDocument()
    })
  })

  describe('tabs', () => {
    beforeEach(() => {
      const node = createMockNode()
      mockCurrentGraph = createMockGraph([node])
      mockSelectedNodeId = 'node-1'
    })

    it('should render all four tabs', () => {
      render(<NodeDetailPanel />)
      expect(screen.getByRole('tab', { name: /概览/ })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /原理/ })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /示例/ })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /实践/ })).toBeInTheDocument()
    })

    it('should show overview tab by default', () => {
      render(<NodeDetailPanel />)
      expect(screen.getByText('描述')).toBeInTheDocument()
      expect(screen.getByText('A JavaScript library for building UIs')).toBeInTheDocument()
    })

    it('should show tags in overview tab', () => {
      render(<NodeDetailPanel />)
      expect(screen.getByText('frontend')).toBeInTheDocument()
      expect(screen.getByText('library')).toBeInTheDocument()
    })

    it('should show estimated time in overview tab', () => {
      render(<NodeDetailPanel />)
      expect(screen.getByText(/约 30 分钟/)).toBeInTheDocument()
    })
  })

  describe('tab switching', () => {
    beforeEach(() => {
      const node = createMockNode()
      mockCurrentGraph = createMockGraph([node])
      mockSelectedNodeId = 'node-1'
    })

    it('should switch to principle tab and show empty state', () => {
      render(<NodeDetailPanel />)
      fireEvent.click(screen.getByRole('tab', { name: /原理/ }))
      expect(screen.getByText('暂无原理说明，展开节点后自动获取')).toBeInTheDocument()
    })

    it('should switch to examples tab and show empty state', () => {
      render(<NodeDetailPanel />)
      fireEvent.click(screen.getByRole('tab', { name: /示例/ }))
      expect(screen.getByText('暂无示例，展开节点后自动获取')).toBeInTheDocument()
    })

    it('should switch to practices tab and show empty state', () => {
      render(<NodeDetailPanel />)
      fireEvent.click(screen.getByRole('tab', { name: /实践/ }))
      expect(screen.getByText('暂无实践建议，展开节点后自动获取')).toBeInTheDocument()
    })
  })

  describe('deep content display', () => {
    it('should display principle content', () => {
      const node = createMockNode({
        principle: 'React uses a virtual DOM to efficiently update the UI',
      })
      mockCurrentGraph = createMockGraph([node])
      mockSelectedNodeId = 'node-1'

      render(<NodeDetailPanel />)
      fireEvent.click(screen.getByRole('tab', { name: /原理/ }))
      expect(screen.getByText('React uses a virtual DOM to efficiently update the UI')).toBeInTheDocument()
    })

    it('should display use cases', () => {
      const node = createMockNode({
        useCases: ['Building SPAs', 'Building dashboards'],
      })
      mockCurrentGraph = createMockGraph([node])
      mockSelectedNodeId = 'node-1'

      render(<NodeDetailPanel />)
      fireEvent.click(screen.getByRole('tab', { name: /示例/ }))
      expect(screen.getByText('Building SPAs')).toBeInTheDocument()
      expect(screen.getByText('Building dashboards')).toBeInTheDocument()
    })

    it('should display examples with code', () => {
      const node = createMockNode({
        examples: [
          {
            title: 'Hello World',
            code: 'console.log("Hello")',
            explanation: 'Basic example',
          },
        ],
      })
      mockCurrentGraph = createMockGraph([node])
      mockSelectedNodeId = 'node-1'

      render(<NodeDetailPanel />)
      fireEvent.click(screen.getByRole('tab', { name: /示例/ }))
      expect(screen.getByText('Hello World')).toBeInTheDocument()
      expect(screen.getByText('console.log("Hello")')).toBeInTheDocument()
      expect(screen.getByText('Basic example')).toBeInTheDocument()
    })

    it('should display best practices', () => {
      const node = createMockNode({
        bestPractices: ['Use functional components', 'Keep components small'],
      })
      mockCurrentGraph = createMockGraph([node])
      mockSelectedNodeId = 'node-1'

      render(<NodeDetailPanel />)
      fireEvent.click(screen.getByRole('tab', { name: /实践/ }))
      expect(screen.getByText('Use functional components')).toBeInTheDocument()
      expect(screen.getByText('Keep components small')).toBeInTheDocument()
    })

    it('should display common mistakes', () => {
      const node = createMockNode({
        commonMistakes: ['Mutating state directly', 'Not using keys in lists'],
      })
      mockCurrentGraph = createMockGraph([node])
      mockSelectedNodeId = 'node-1'

      render(<NodeDetailPanel />)
      fireEvent.click(screen.getByRole('tab', { name: /实践/ }))
      expect(screen.getByText('Mutating state directly')).toBeInTheDocument()
      expect(screen.getByText('Not using keys in lists')).toBeInTheDocument()
    })

    it('should display keyTerms in overview tab', () => {
      const node = createMockNode({
        keyTerms: [
          { term: 'Virtual DOM', definition: 'A lightweight copy of the real DOM' },
          { term: 'Reconciliation', definition: 'React\'s algorithm for diffing virtual DOM trees' },
        ],
      })
      mockCurrentGraph = createMockGraph([node])
      mockSelectedNodeId = 'node-1'

      render(<NodeDetailPanel />)
      expect(screen.getByText('关键术语')).toBeInTheDocument()
      expect(screen.getByText('Virtual DOM')).toBeInTheDocument()
      expect(screen.getByText(/A lightweight copy of the real DOM/)).toBeInTheDocument()
      expect(screen.getByText('Reconciliation')).toBeInTheDocument()
    })

    it('should not show keyTerms section when keyTerms is empty', () => {
      const node = createMockNode()
      mockCurrentGraph = createMockGraph([node])
      mockSelectedNodeId = 'node-1'

      render(<NodeDetailPanel />)
      expect(screen.queryByText('关键术语')).not.toBeInTheDocument()
    })

    it('should display subTopics in overview tab', () => {
      const node = createMockNode({
        subTopics: [
          { title: 'State Hooks', description: 'Manage component state', keyPoints: ['useState', 'useReducer'] },
          { title: 'Effect Hooks', description: 'Handle side effects' },
        ],
      })
      mockCurrentGraph = createMockGraph([node])
      mockSelectedNodeId = 'node-1'

      render(<NodeDetailPanel />)
      expect(screen.getByText('子话题')).toBeInTheDocument()
      expect(screen.getByText('State Hooks')).toBeInTheDocument()
      expect(screen.getByText(/Manage component state/)).toBeInTheDocument()
      expect(screen.getByText('Effect Hooks')).toBeInTheDocument()
      expect(screen.getByText('Handle side effects')).toBeInTheDocument()
    })

    it('should display subTopic keyPoints', () => {
      const node = createMockNode({
        subTopics: [
          { title: 'State Hooks', description: 'Manage state', keyPoints: ['useState', 'useReducer'] },
        ],
      })
      mockCurrentGraph = createMockGraph([node])
      mockSelectedNodeId = 'node-1'

      render(<NodeDetailPanel />)
      expect(screen.getByText('useState')).toBeInTheDocument()
      expect(screen.getByText('useReducer')).toBeInTheDocument()
    })

    it('should not show subTopics section when subTopics is empty', () => {
      const node = createMockNode()
      mockCurrentGraph = createMockGraph([node])
      mockSelectedNodeId = 'node-1'

      render(<NodeDetailPanel />)
      expect(screen.queryByText('子话题')).not.toBeInTheDocument()
    })
  })

  describe('QA tab', () => {
    it('should render QA tab trigger', () => {
      const node = createMockNode()
      mockCurrentGraph = createMockGraph([node])
      mockSelectedNodeId = 'node-1'

      render(<NodeDetailPanel />)
      expect(screen.getByRole('tab', { name: /问答/ })).toBeInTheDocument()
    })

    it('should show empty state in QA tab', () => {
      const node = createMockNode()
      mockCurrentGraph = createMockGraph([node])
      mockSelectedNodeId = 'node-1'

      render(<NodeDetailPanel />)
      fireEvent.click(screen.getByRole('tab', { name: /问答/ }))
      expect(screen.getByText('对这个知识点提问，深入探索')).toBeInTheDocument()
    })

    it('should render question input and submit button', () => {
      const node = createMockNode()
      mockCurrentGraph = createMockGraph([node])
      mockSelectedNodeId = 'node-1'

      render(<NodeDetailPanel />)
      fireEvent.click(screen.getByRole('tab', { name: /问答/ }))
      expect(screen.getByPlaceholderText('输入你的问题...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /提问/ })).toBeInTheDocument()
    })

    it('should render QA history list', () => {
      const node = createMockNode({
        qas: [
          {
            id: 'qa-1',
            question: 'What is Virtual DOM?',
            answer: 'A lightweight copy of the real DOM',
            action: 'save_only',
            actionResult: 'saved',
            createdAt: new Date(),
          },
        ],
      })
      mockCurrentGraph = createMockGraph([node])
      mockSelectedNodeId = 'node-1'

      render(<NodeDetailPanel />)
      fireEvent.click(screen.getByRole('tab', { name: /问答/ }))
      expect(screen.getByText('What is Virtual DOM?')).toBeInTheDocument()
      expect(screen.getByText('A lightweight copy of the real DOM')).toBeInTheDocument()
    })
  })

  describe('relation navigation', () => {
    it('should display incoming relations in overview tab', () => {
      const node1 = createMockNode({ id: 'node-1', title: 'React' })
      const node2 = createMockNode({ id: 'node-2', title: 'JavaScript' })
      mockCurrentGraph = createMockGraph([node1, node2], [
        { id: 'edge-1', source: 'node-2', target: 'node-1', type: 'prerequisite' },      ])
      mockSelectedNodeId = 'node-1'

      render(<NodeDetailPanel />)
      expect(screen.getByText('JavaScript')).toBeInTheDocument()
    })

    it('should navigate to related node on click', () => {
      const node1 = createMockNode({ id: 'node-1', title: 'React' })
      const node2 = createMockNode({ id: 'node-2', title: 'JavaScript' })
      mockCurrentGraph = createMockGraph([node1, node2], [
        { id: 'edge-1', source: 'node-2', target: 'node-1', type: 'prerequisite' },
      ])
      mockSelectedNodeId = 'node-1'

      render(<NodeDetailPanel />)
      fireEvent.click(screen.getByText('JavaScript'))
      expect(mockSelectNode).toHaveBeenCalledWith('node-2')
      expect(mockSetFocusMode).toHaveBeenCalledWith(true)
    })
  })
})
