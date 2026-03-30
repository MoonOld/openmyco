import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    testTimeout: 300000, // 5 minutes for LLM API calls
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/**/__tests__/**/*.{test,spec}.{ts,tsx}',
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/**/__benchmarks__/**/*.{test,spec}.{ts,tsx}',
    ],
    benchmark: {
      include: ['src/**/*.{bench,benchmark}.{ts,tsx}'],
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
