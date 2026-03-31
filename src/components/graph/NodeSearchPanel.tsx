import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReactFlow } from 'reactflow'
import { Search, Lightbulb, Book, Wrench, Code } from 'lucide-react'
import { useKnowledgeStore } from '@/stores'
import { cn } from '@/lib/utils'

const typeIcons = { concept: Lightbulb, skill: Book, tool: Wrench, theory: Code }

const typeLabels: Record<string, string> = {
  concept: '概念',
  skill: '技能',
  tool: '工具',
  theory: '理论',
}

interface SearchResult {
  id: string
  title: string
  type: string
  matchIndex: number
}

function highlightTitle(title: string, query: string) {
  const lowerTitle = title.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const idx = lowerTitle.indexOf(lowerQuery)
  if (idx === -1) return <span>{title}</span>

  return (
    <>
      <span>{title.slice(0, idx)}</span>
      <mark className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">
        {title.slice(idx, idx + query.length)}
      </mark>
      <span>{title.slice(idx + query.length)}</span>
    </>
  )
}

export function NodeSearchPanel() {
  const { currentGraph, selectNode } = useKnowledgeStore()
  const { fitView } = useReactFlow()

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Search logic
  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim() || !currentGraph) return []

    const lowerQuery = query.toLowerCase()
    const matches: SearchResult[] = []

    currentGraph.nodes.forEach((node) => {
      const lowerTitle = node.title.toLowerCase()
      const matchIndex = lowerTitle.indexOf(lowerQuery)
      if (matchIndex !== -1) {
        matches.push({
          id: node.id,
          title: node.title,
          type: node.type,
          matchIndex,
        })
      }
    })

    // Sort: exact match > prefix match > contains match (by position)
    matches.sort((a, b) => {
      const aExact = a.title.toLowerCase() === lowerQuery ? 0 : 1
      const bExact = b.title.toLowerCase() === lowerQuery ? 0 : 1
      if (aExact !== bExact) return aExact - bExact
      return a.matchIndex - b.matchIndex
    })

    return matches.slice(0, 10)
  }, [query, currentGraph])

  // Reset activeIndex when results change
  const safeActiveIndex = results.length > 0 ? Math.min(activeIndex, results.length - 1) : -1

  // Select a node
  const handleSelectNode = useCallback(
    (nodeId: string) => {
      selectNode(nodeId)
      setTimeout(() => {
        fitView({ nodes: [{ id: nodeId }], duration: 300, padding: 0.5 })
      }, 80)
      setIsOpen(false)
      setQuery('')
    },
    [selectNode, fitView]
  )

  // Global keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
        if (!isOpen) {
          setTimeout(() => inputRef.current?.focus(), 0)
        }
      }

      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        setIsOpen(false)
        setQuery('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return

    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen])

  // Keyboard navigation in input
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev + 1) % Math.max(results.length, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev - 1 + results.length) % Math.max(results.length, 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (safeActiveIndex >= 0 && safeActiveIndex < results.length) {
        handleSelectNode(results[safeActiveIndex].id)
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setQuery('')
    }
  }

  if (!currentGraph) return null

  // Collapsed state: search button
  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setIsOpen(true)
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
        className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-xs rounded border bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
      >
        <Search className="h-3 w-3" />
        <span>搜索节点</span>
        <kbd className="ml-auto text-[10px] bg-muted px-1 py-0.5 rounded font-mono">
          ⌘K
        </kbd>
      </button>
    )
  }

  // Expanded state: search input + results
  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-primary/30 bg-background">
        <Search className="h-3 w-3 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="输入节点标题..."
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
        <kbd className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono text-muted-foreground">
          ESC
        </kbd>
      </div>

      {/* Results dropdown */}
      {query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              未找到匹配的节点
            </div>
          ) : (
            results.map((result, index) => {
              const Icon = typeIcons[result.type as keyof typeof typeIcons] || Lightbulb
              return (
                <button
                  key={result.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectNode(result.id)
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors',
                    index === safeActiveIndex
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted text-foreground'
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    {highlightTitle(result.title, query)}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {typeLabels[result.type] || result.type}
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
