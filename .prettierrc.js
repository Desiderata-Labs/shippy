const path = require('node:path')

/** @type {import('prettier').Config} */
module.exports = {
  semi: false,
  trailingComma: 'all',
  singleQuote: true,
  endOfLine: 'lf',
  plugins: [
    require.resolve('@trivago/prettier-plugin-sort-imports'),
    require.resolve('prettier-plugin-tailwindcss'),
  ],
  tailwindStylesheet: path.resolve(__dirname, './src/app/globals.css'),
  importOrder: [
    'react',
    '^react-.*$',
    '^next',
    '^next-.*$',
    '^next/.*$',
    '^@/lib/.*$',
    '^@/contexts/.*$',
    '^@/hooks/.*$',
    '^@/components/.*$',
    '^@/app/.*$',
    '^@/types/.*$',
    '^@/utils/.*$',
    '^[./]',
    '.*',
  ],
  importOrderSeparation: false,
  importOrderSortSpecifiers: true,
}
