'use client'

import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import { AutoLinkPlugin } from '@lexical/react/LexicalAutoLinkPlugin'
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin'
import { useCallback, useRef } from 'react'
import { LINK_MATCHERS } from '@/lib/lexical/auto-link-config'
import { ClickableLinkPlugin } from '@/lib/lexical/clickable-link-plugin'
import { editorTheme } from '@/lib/lexical/editor-theme'
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  markdownTransformers,
} from '@/lib/lexical/markdown-transformers'
import { MentionNode } from '@/lib/lexical/mention-node'
import { MentionPlugin } from '@/lib/lexical/mention-plugin'
import { SyncPlugin } from '@/lib/lexical/sync-plugin'
import { cn } from '@/lib/utils'
import { FloatingToolbar } from '@/components/ui/floating-toolbar'
import { CodeHighlightNode, CodeNode } from '@lexical/code'
import { HorizontalRuleNode } from '@lexical/extension'
import { AutoLinkNode, LinkNode } from '@lexical/link'
import { ListItemNode, ListNode } from '@lexical/list'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { $createParagraphNode, $getRoot, EditorState } from 'lexical'

// ============================================================================
// Editor Component
// ============================================================================

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  className?: string
  contentClassName?: string
  minHeight?: string
  maxHeight?: string
  hideMarkdownHint?: boolean
  /** Enable @mention autocomplete */
  enableMentions?: boolean
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write something...',
  disabled = false,
  autoFocus = false,
  className,
  contentClassName,
  minHeight = '150px',
  maxHeight = '50vh',
  hideMarkdownHint = false,
  enableMentions = false,
}: MarkdownEditorProps) {
  const initialValueRef = useRef(value)

  const initialConfig = {
    namespace: 'MarkdownEditor',
    editorState: () => {
      const root = $getRoot()
      if (value) {
        $convertFromMarkdownString({
          markdown: value,
          transformers: markdownTransformers,
          node: root,
          shouldPreserveNewLines: true,
        })
      } else {
        root.append($createParagraphNode())
      }
    },
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      CodeHighlightNode,
      AutoLinkNode,
      LinkNode,
      HorizontalRuleNode,
      MentionNode,
    ],
    onError: (error: Error) => {
      console.error('MarkdownEditor error:', error)
    },
    theme: editorTheme,
    editable: !disabled,
  }

  const handleChange = useCallback(
    (editorState: EditorState) => {
      editorState.read(() => {
        const markdown = $convertToMarkdownString({
          transformers: markdownTransformers,
        })
        // Only call onChange if the value actually changed
        if (markdown !== initialValueRef.current) {
          initialValueRef.current = markdown
          onChange(markdown)
        }
      })
    },
    [onChange],
  )

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className={cn('relative', className)}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className={cn(
                'prose prose-sm max-w-none resize-none overflow-auto bg-transparent px-0 py-2 caret-primary outline-none dark:prose-invert',
                'prose-headings:my-2 prose-p:my-1 prose-ol:my-2 prose-ul:my-2',
                disabled && 'cursor-not-allowed opacity-50',
                contentClassName,
              )}
              style={{ minHeight, maxHeight }}
              aria-placeholder={placeholder}
              data-lexical-editor="true"
              placeholder={
                <div className="pointer-events-none absolute top-3 left-0 text-sm text-muted-foreground opacity-75">
                  {placeholder}
                </div>
              }
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        {autoFocus && <AutoFocusPlugin />}
        <ListPlugin />
        <CheckListPlugin />
        <TabIndentationPlugin />
        <LinkPlugin />
        <AutoLinkPlugin matchers={LINK_MATCHERS} />
        <ClickableLinkPlugin />
        <FloatingToolbar />
        {enableMentions && <MentionPlugin />}
        <MarkdownShortcutPlugin transformers={markdownTransformers} />
        <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
        <SyncPlugin value={value} initialValueRef={initialValueRef} />
        {!hideMarkdownHint && (
          <div className="mt-1 flex justify-end">
            <span className="text-xs text-muted-foreground/60">
              Markdown supported
            </span>
          </div>
        )}
      </div>
    </LexicalComposer>
  )
}
