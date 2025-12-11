'use client'

import React, { memo, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Button } from './button'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'

type MarkdownViewerProps = {
  markdown: string
  className?: string
  proseSize?: 'xs' | 'sm' | 'base' | 'lg'
  maxHeightToReadMore?: number
}

const components: Partial<Components> = {
  img({ src, alt }) {
    if (!src || typeof src !== 'string') return null
    return (
      <span className="flex justify-center">
        <Image
          src={src}
          alt={alt ?? ''}
          width={400}
          height={300}
          className="h-auto max-w-full rounded-lg"
          unoptimized
        />
      </span>
    )
  },
  table({ children }) {
    return (
      <table className="border-collapse border px-3 py-1">{children}</table>
    )
  },
  th({ children }) {
    return (
      <th className="border bg-muted px-3 py-1 wrap-break-word text-foreground">
        {children}
      </th>
    )
  },
  td({ children }) {
    return <td className="border px-3 py-1 wrap-break-word">{children}</td>
  },
  ol: ({ children, ...props }) => (
    <ol className="ml-4 list-outside list-decimal" {...props}>
      {children}
    </ol>
  ),
  ul: ({ children, ...props }) => (
    <ul className="ml-4 list-outside list-disc" {...props}>
      {children}
    </ul>
  ),
  li: ({ children, ...props }) => (
    <li className="py-1" {...props}>
      {children}
    </li>
  ),
  strong: ({ children, ...props }) => (
    <span className="font-semibold" {...props}>
      {children}
    </span>
  ),
  a: ({ children, href, ...props }) => (
    <a
      className="font-bold text-primary hover:underline"
      href={href ?? '#'}
      target="_blank"
      rel="noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
}

const NonMemoizedMarkdownViewer = ({
  markdown,
  className,
  proseSize = 'base',
  maxHeightToReadMore,
}: MarkdownViewerProps) => {
  const [isExpanded, setIsExpanded] = useState(false)

  // prose-xs doesn't exist, so we use prose-sm + text-xs override
  const proseSizeClass = {
    xs: 'prose-sm text-xs **:text-xs',
    sm: 'prose-sm',
    base: 'prose-base',
    lg: 'prose-lg',
  }[proseSize]

  const content = (
    <div
      className={cn(
        'prose w-full max-w-none dark:prose-invert',
        proseSizeClass,
        'text-foreground',
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )

  if (!maxHeightToReadMore) {
    return <div className={cn('flex flex-row', className)}>{content}</div>
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div
        className={cn('relative', {
          'max-h-(--max-height)': !isExpanded,
          'overflow-hidden': !isExpanded,
        })}
        style={
          { '--max-height': `${maxHeightToReadMore}px` } as React.CSSProperties
        }
      >
        {content}
        {!isExpanded && (
          <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-background to-transparent" />
        )}
      </div>
      <Button
        variant="link"
        className="mt-2 w-fit cursor-pointer self-start px-0 font-bold text-muted-foreground hover:underline"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? 'Show Less' : 'Read More'}
      </Button>
    </div>
  )
}

export const Markdown = memo(
  NonMemoizedMarkdownViewer,
  (prevProps, nextProps) =>
    prevProps.markdown === nextProps.markdown &&
    prevProps.className === nextProps.className &&
    prevProps.proseSize === nextProps.proseSize &&
    prevProps.maxHeightToReadMore === nextProps.maxHeightToReadMore,
)
