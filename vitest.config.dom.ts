import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      // Only include DOM-dependent tests in jsdom environment
      'src/**/split-node-at-selection.test.ts',
      'src/**/markdown-transformers.test.ts',
    ],
    exclude: ['node_modules/**', 'examples/**'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['node_modules/'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
