import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import betterTailwindcss from 'eslint-plugin-better-tailwindcss'
import { defineConfig, globalIgnores } from 'eslint/config'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      'better-tailwindcss': betterTailwindcss,
    },
    rules: {
      // Auto-fixable: converts long-form classes to shorthand (e.g., w-full h-full → size-full)
      'better-tailwindcss/enforce-shorthand-classes': 'warn',
      // Warns about deprecated class names (e.g., rounded → rounded-sm in v4)
      'better-tailwindcss/no-deprecated-classes': 'warn',
      // Auto-fixable: removes duplicate classes
      'better-tailwindcss/no-duplicate-classes': 'warn',
      // Auto-fixable: removes unnecessary whitespace
      'better-tailwindcss/no-unnecessary-whitespace': 'warn',
      // Disabled: prettier-plugin-tailwindcss handles sorting
      'better-tailwindcss/sort-classes': 'off',
      // Disabled: too many false positives with custom utilities
      'better-tailwindcss/no-unregistered-classes': 'off',
    },
    settings: {
      'better-tailwindcss': {
        entryPoint: 'src/app/globals.css',
        // Recognize cn() and cva() as class name functions
        callee: {
          cn: [{ name: 'first', type: 'spreadable' }],
          cva: [
            { name: 'first', type: 'string' },
            { name: 'second', type: 'object' },
          ],
        },
      },
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    '.prettierrc.js',
    // Custom ignores
    'tmp/**',
    'prds/assembly-made/**',
    'examples/**',
  ]),
])

export default eslintConfig
