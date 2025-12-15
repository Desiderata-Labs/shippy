import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    exclude: [
      'node_modules/**',
      'examples/**',
      // Exclude DOM-dependent tests from Node.js environment
      '**/split-node-at-selection.test.ts',
      '**/markdown-transformers.test.ts',
    ],
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
