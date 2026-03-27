import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 操作状态（扩展自 KnowledgeNode 的 OperationStatus）
export type OperationStatus = 'pending' | 'success' | 'failed' | 'cancelled'

// 操作类型
export type OperationType = 'create_graph' | 'expand_node'

// 操作上下文
export interface OperationContext {
  id: string                        // 操作唯一 ID
  type: OperationType               // 操作类型
  targetGraphId: string             // 目标图谱 ID
  targetNodeId: string              // 目标节点 ID（create_graph 时为根节点）
  topic: string                     // 操作主题
  status: OperationStatus           // 操作状态
  error?: string                    // 错误信息
  version: number                   // 版本号（用于并发控制）
  startedAt: Date                   // 开始时间
  completedAt?: Date                // 完成时间
}

// 输入参数（不包含自动生成的字段）
export type StartOperationInput = Omit<OperationContext, 'status' | 'version' | 'startedAt'>

// 操作状态
interface OperationState {
  operations: Map<string, OperationContext>

  // Actions
  startOperation: (ctx: StartOperationInput) => string
  completeOperation: (operationId: string) => void
  failOperation: (operationId: string, error: string) => void
  cancelOperation: (operationId: string) => void
  getOperation: (operationId: string) => OperationContext | undefined
  getPendingOperations: (graphId: string) => OperationContext[]
  getLatestOperationForNode: (graphId: string, nodeId: string) => OperationContext | undefined
  clearCompletedOperations: () => void
}

export const useOperationStore = create<OperationState>()(
  persist(
    (set, get) => ({
      operations: new Map(),

      startOperation: (ctx) => {
        const operationId = ctx.id
        const operation: OperationContext = {
          ...ctx,
          status: 'pending',
          version: 1,
          startedAt: new Date(),
        }

        set((state) => {
          const operations = new Map(state.operations)
          operations.set(operationId, operation)
          return { operations }
        })

        return operationId
      },

      completeOperation: (operationId) => {
        set((state) => {
          const operations = new Map(state.operations)
          const op = operations.get(operationId)
          if (op && op.status === 'pending') {
            operations.set(operationId, {
              ...op,
              status: 'success',
              completedAt: new Date(),
            })
          }
          return { operations }
        })
      },

      failOperation: (operationId, error) => {
        set((state) => {
          const operations = new Map(state.operations)
          const op = operations.get(operationId)
          if (op && op.status === 'pending') {
            operations.set(operationId, {
              ...op,
              status: 'failed',
              error,
              completedAt: new Date(),
            })
          }
          return { operations }
        })
      },

      cancelOperation: (operationId) => {
        set((state) => {
          const operations = new Map(state.operations)
          const op = operations.get(operationId)
          if (op && op.status === 'pending') {
            operations.set(operationId, {
              ...op,
              status: 'cancelled',
              completedAt: new Date(),
            })
          }
          return { operations }
        })
      },

      getOperation: (operationId) => {
        return get().operations.get(operationId)
      },

      getPendingOperations: (graphId) => {
        const operations = get().operations
        return Array.from(operations.values()).filter(
          (op) => op.targetGraphId === graphId && op.status === 'pending'
        )
      },

      getLatestOperationForNode: (graphId, nodeId) => {
        const operations = get().operations
        const nodeOps = Array.from(operations.values()).filter(
          (op) => op.targetGraphId === graphId && op.targetNodeId === nodeId
        )
        // 返回版本号最高的操作
        return nodeOps.sort((a, b) => b.version - a.version)[0]
      },

      clearCompletedOperations: () => {
        set((state) => {
          const operations = new Map(state.operations)
          Array.from(operations.entries()).forEach(([id, op]) => {
            if (op.status !== 'pending') {
              operations.delete(id)
            }
          })
          return { operations }
        })
      },
    }),
    {
      name: 'operation-storage',
      partialize: (state) => ({
        operations: Array.from(state.operations.entries()),
      }),
      merge: (persistedState: unknown, currentState: OperationState) => {
        const state = persistedState as { operations?: Array<[string, OperationContext]> }
        if (state.operations) {
          return {
            ...currentState,
            operations: new Map(state.operations),
          }
        }
        return currentState
      },
    }
  )
)
