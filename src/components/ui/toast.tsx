import * as React from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

export interface ToastProps {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive'
  onClose?: () => void
}

export function Toast({ title, description, variant = 'default', onClose }: ToastProps) {
  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 w-80 rounded-lg border p-4 shadow-lg transition-all',
        variant === 'destructive'
          ? 'border-destructive bg-destructive text-destructive-foreground'
          : 'border-border bg-background'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h5 className="font-medium">{title}</h5>
          {description && (
            <p className="mt-1 text-sm opacity-90">{description}</p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-2 opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export function ToastContainer({ children }: { children: React.ReactNode }) {
  return <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">{children}</div>
}
