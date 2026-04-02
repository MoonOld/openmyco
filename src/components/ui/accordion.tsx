import { useState, createContext, useContext, useCallback } from 'react'
import { cn } from '@/lib/utils'

// Root context
interface AccordionContextValue {
  openItems: Set<string>
  toggle: (value: string) => void
}

const AccordionContext = createContext<AccordionContextValue | null>(null)

function useAccordionContext() {
  const ctx = useContext(AccordionContext)
  if (!ctx) throw new Error('Accordion compound components must be used within <Accordion>')
  return ctx
}

// Item context
const AccordionItemContext = createContext<string | null>(null)

function useAccordionItemContext() {
  const value = useContext(AccordionItemContext)
  if (value === null) throw new Error('Must be used within <AccordionItem>')
  return value
}

// Accordion Root
interface AccordionProps {
  type?: 'single' | 'multiple'
  defaultValue?: string[]
  children: React.ReactNode
  className?: string
}

function Accordion({ type = 'multiple', defaultValue = [], children, className }: AccordionProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(() => new Set(defaultValue))

  const toggle = useCallback((value: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev)
      if (next.has(value)) {
        next.delete(value)
      } else {
        if (type === 'single') next.clear()
        next.add(value)
      }
      return next
    })
  }, [type])

  return (
    <AccordionContext.Provider value={{ openItems, toggle }}>
      <div className={className}>
        {children}
      </div>
    </AccordionContext.Provider>
  )
}

// AccordionItem
interface AccordionItemProps {
  value: string
  children: React.ReactNode
  className?: string
}

function AccordionItem({ value, children, className }: AccordionItemProps) {
  const { openItems } = useAccordionContext()
  const isOpen = openItems.has(value)

  return (
    <AccordionItemContext.Provider value={value}>
      <div
        data-state={isOpen ? 'open' : 'closed'}
        className={cn('border-b last:border-b-0', className)}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  )
}

// AccordionTrigger
interface AccordionTriggerProps {
  children: React.ReactNode
  className?: string
}

function AccordionTrigger({ children, className }: AccordionTriggerProps) {
  const { openItems, toggle } = useAccordionContext()
  const value = useAccordionItemContext()
  const isOpen = openItems.has(value)

  return (
    <h3 className="flex">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={`accordion-content-${value}`}
        id={`accordion-trigger-${value}`}
        onClick={() => toggle(value)}
        className={cn(
          'flex flex-1 items-center justify-between py-3 text-sm font-medium transition-all hover:underline',
          className
        )}
      >
        {children}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            'shrink-0 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </h3>
  )
}

// AccordionContent
interface AccordionContentProps {
  children: React.ReactNode
  className?: string
}

function AccordionContent({ children, className }: AccordionContentProps) {
  const { openItems } = useAccordionContext()
  const value = useAccordionItemContext()
  const isOpen = openItems.has(value)

  if (!isOpen) return null

  return (
    <div
      role="region"
      aria-labelledby={`accordion-trigger-${value}`}
      id={`accordion-content-${value}`}
      className={cn('overflow-hidden text-sm pb-4 pt-0', className)}
    >
      {children}
    </div>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
