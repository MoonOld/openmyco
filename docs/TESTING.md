# OpenMyco - 测试文档

## 测试概览

```bash
npm test              # 交互式监视模式
npm run test:run       # 运行一次所有测试
npm run test:coverage  # 生成覆盖率报告
```

## 测试覆盖范围

### 当前覆盖

| 模块 | 覆盖率 | 测试文件 |
|------|--------|----------|
| lib/utils.ts | ~90% | lib/__tests__/utils.test.ts |
| lib/llm/parsers.ts | ~95% | lib/llm/__tests__/parsers.test.ts |
| stores/ | ~85% | stores/__tests__/*.test.ts |

### 不覆盖的内容

- UI 组件（价值低，维护成本高）
- 第三方库
- 简单的样式组件

## 测试策略

### 1. 单元测试

**工具函数** (`lib/utils.test.ts`)
```typescript
describe('cn', () => {
  it('should merge class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })
})
```

**LLM 解析器** (`lib/llm/__tests__/parsers.test.ts`)
```typescript
describe('parseKnowledgeResponse', () => {
  it('should parse valid JSON response', () => {
    const json = JSON.stringify({ ... })
    const result = parseKnowledgeResponse(json)
    expect(result?.node.title).toBe('React')
  })
})
```

### 2. 状态管理测试

**Store 测试** (`stores/__tests__/knowledgeStore.test.ts`)
```typescript
describe('knowledgeStore', () => {
  it('should select a node', () => {
    const { result } = renderHook(() => useKnowledgeStore())
    act(() => {
      result.current.selectNode('node-1')
    })
    expect(result.current.selectedNodeId).toBe('node-1')
  })
})
```

### 3. 集成测试（未来）

添加组件交互测试：
```typescript
describe('ChatInput', () => {
  it('should submit topic and generate graph', async () => {
    // Mock LLM API
    // 输入知识点
    // 点击提交
    // 验证图谱创建
  })
})
```

## 测试最佳实践

### DO ✅

1. **测试纯函数逻辑**
   ```typescript
   // 好的测试
   expect(formatDate(date)).toContain('2024')
   ```

2. **测试边界条件**
   ```typescript
   it('should handle empty array', () => {
     expect(arrayToNodes([]).size).toBe(0)
   })
   ```

3. **使用 mock 隔离外部依赖**
   ```typescript
   vi.mock('dexie')
   ```

### DON'T ❌

1. **不要测试第三方库**
   ```typescript
   // 坏的测试
   it('should call React.memo', () => { ... })
   ```

2. **不要测试样式**
   ```typescript
   // 坏的测试
   expect(element.className).toContain('px-4')
   ```

3. **不要过度测试组件**
   ```typescript
   // 不必要的测试
   it('should render a button', () => {
     render(<Button />)
     expect(screen.getByRole('button')).toBeInTheDocument()
   })
   ```

## Mock 设置

### IndexedDB Mock
```typescript
// src/test/setup.ts
vi.mock('dexie', () => ({
  default: class {
    async toArray() { return [] }
    async get() { return undefined }
    // ...
  }
}))
```

### localStorage Mock
```typescript
// src/test/setup.ts
vi.stubGlobal('localStorage', {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
})
```

## 运行特定测试

```bash
# 运行单个测试文件
npm test -- lib/utils.test.ts

# 运行匹配模式的测试
npm test -- utils

# 监视模式
npm test -- --watch

# 显示详细输出
npm test -- --reporter=verbose
```

## 调试测试

```typescript
// 只运行某个测试
test.only('should do something', () => { ... })

// 跳过某个测试
test.skip('should do something', () => { ... })

// 打印调试信息
console.log('State:', useKnowledgeStore.getState())
```

## 覆盖率目标

| 模块 | 目标覆盖率 |
|------|-----------|
| lib/ | 90%+ |
| stores/ | 80%+ |
| components/ | 50%+ |
| 整体 | 75%+ |
