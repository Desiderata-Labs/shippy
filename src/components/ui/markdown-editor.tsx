'use client'

import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import {
  AutoLinkPlugin,
  createLinkMatcherWithRegExp,
} from '@lexical/react/LexicalAutoLinkPlugin'
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin'
import { useCallback, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { FloatingToolbar } from '@/components/ui/floating-toolbar'
import { CodeHighlightNode, CodeNode } from '@lexical/code'
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
} from '@lexical/extension'
import { $isLinkNode, AutoLinkNode, LinkNode } from '@lexical/link'
import { ListItemNode, ListNode } from '@lexical/list'
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  CHECK_LIST,
  ELEMENT_TRANSFORMERS,
  type ElementTransformer,
  MULTILINE_ELEMENT_TRANSFORMERS,
  TEXT_FORMAT_TRANSFORMERS,
  TEXT_MATCH_TRANSFORMERS,
  type Transformer,
} from '@lexical/markdown'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { $findMatchingParent, isHTMLAnchorElement } from '@lexical/utils'
import {
  $createParagraphNode,
  $getNearestNodeFromDOMNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  EditorState,
  getNearestEditorFromDOMNode,
  isDOMNode,
} from 'lexical'

// ============================================================================
// Theme
// ============================================================================

const editorTheme = {
  paragraph: 'my-1',
  placeholder: 'text-sm text-muted-foreground! opacity-50',
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    underlineStrikethrough: 'underline line-through',
    code: 'bg-muted px-1.5 py-0.5 rounded font-mono text-sm',
  },
  heading: {
    h1: 'text-2xl font-bold my-3',
    h2: 'text-xl font-bold my-2',
    h3: 'text-lg font-bold my-2',
    h4: 'text-base font-bold my-1',
    h5: 'text-sm font-bold my-1',
    h6: 'text-xs font-bold my-1',
  },
  list: {
    nested: {
      listitem: 'lexical-nested-listitem',
    },
    ol: 'pl-5 my-2 list-decimal',
    ul: 'pl-5 my-2 list-disc',
    listitem: 'my-1',
    listitemChecked: 'lexical-listitem-checked',
    listitemUnchecked: 'lexical-listitem-unchecked',
  },
  link: 'text-primary underline hover:text-primary/80 cursor-pointer',
  quote: 'border-l-4 border-muted px-4 py-2 my-2 text-muted-foreground',
  code: 'bg-muted p-3 my-4 rounded font-mono text-sm',
}

// ============================================================================
// Markdown Transformers
// ============================================================================

const HR: ElementTransformer = {
  dependencies: [HorizontalRuleNode],
  export: (node) => {
    return $isHorizontalRuleNode(node) ? '***' : null
  },
  regExp: /^(---|\*\*\*|___)\s?$/,
  replace: (parentNode, _1, _2, isImport) => {
    const line = $createHorizontalRuleNode()
    if (isImport || parentNode.getNextSibling() != null) {
      parentNode.replace(line)
    } else {
      parentNode.insertBefore(line)
    }
    line.selectNext()
  },
  type: 'element',
}

const markdownTransformers: Array<Transformer> = [
  HR,
  CHECK_LIST,
  ...ELEMENT_TRANSFORMERS,
  ...MULTILINE_ELEMENT_TRANSFORMERS,
  ...TEXT_FORMAT_TRANSFORMERS,
  ...TEXT_MATCH_TRANSFORMERS,
]

// ============================================================================
// Auto-Link Configuration
// ============================================================================

const URL_REGEX =
  /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)(?<![-.+():%])/

const EMAIL_REGEX =
  /(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/

const LINK_MATCHERS = [
  createLinkMatcherWithRegExp(URL_REGEX, (text) => {
    return text.startsWith('http') ? text : `https://${text}`
  }),
  createLinkMatcherWithRegExp(EMAIL_REGEX, (text) => {
    return `mailto:${text}`
  }),
]

// ============================================================================
// Clickable Link Plugin
// ============================================================================

function isUrlSafe(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    const allowedProtocols = ['http:', 'https:', 'mailto:']
    return allowedProtocols.includes(parsedUrl.protocol)
  } catch {
    return false
  }
}

function findMatchingDOM<T extends Node>(
  startNode: Node,
  predicate: (node: Node) => node is T,
): T | null {
  let node: Node | null = startNode
  while (node != null) {
    if (predicate(node)) {
      return node
    }
    node = node.parentNode
  }
  return null
}

function ClickableLinkPlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!isDOMNode(target)) {
        return
      }
      const nearestEditor = getNearestEditorFromDOMNode(target)

      if (nearestEditor === null) {
        return
      }

      let url: string | null = null
      nearestEditor.update(() => {
        const clickedNode = $getNearestNodeFromDOMNode(target)
        if (clickedNode !== null) {
          const maybeLinkNode = $findMatchingParent(clickedNode, $isElementNode)
          if ($isLinkNode(maybeLinkNode)) {
            url = maybeLinkNode.sanitizeUrl(maybeLinkNode.getURL())
          } else {
            const a = findMatchingDOM(target, isHTMLAnchorElement)
            if (a !== null) {
              url = a.href
            }
          }
        }
      })

      if (url === null || url === '') {
        return
      }

      // Allow user to select link text without following url
      const selection = editor.getEditorState().read($getSelection)
      if ($isRangeSelection(selection) && !selection.isCollapsed()) {
        event.preventDefault()
        return
      }

      event.preventDefault()

      if (!isUrlSafe(url)) {
        console.warn(`Blocked potentially unsafe URL: ${url}`)
        return
      }

      const isMiddle = event.type === 'auxclick' && event.button === 1
      window.open(
        url,
        isMiddle || event.metaKey || event.ctrlKey ? '_blank' : '_blank',
        'noopener,noreferrer',
      )
    }

    const onMouseUp = (event: MouseEvent) => {
      if (event.button === 1) {
        onClick(event)
      }
    }

    return editor.registerRootListener((rootElement, prevRootElement) => {
      if (prevRootElement !== null) {
        prevRootElement.removeEventListener('click', onClick)
        prevRootElement.removeEventListener('mouseup', onMouseUp)
      }
      if (rootElement !== null) {
        rootElement.addEventListener('click', onClick)
        rootElement.addEventListener('mouseup', onMouseUp)
      }
    })
  }, [editor])

  return null
}

// ============================================================================
// Sync Plugin - handles external value changes
// ============================================================================

interface SyncPluginProps {
  value: string
  initialValueRef: React.MutableRefObject<string>
}

function SyncPlugin({ value, initialValueRef }: SyncPluginProps): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    // Skip if this is the initial render or if value matches what we have
    if (value === initialValueRef.current) {
      return
    }

    // Check if the current editor content matches the incoming value
    let currentMarkdown = ''
    editor.read(() => {
      currentMarkdown = $convertToMarkdownString(markdownTransformers)
    })

    // Only update if the value is actually different
    if (currentMarkdown !== value) {
      editor.update(() => {
        const root = $getRoot()
        root.clear()
        if (value) {
          $convertFromMarkdownString(value, markdownTransformers, root, true)
        } else {
          root.append($createParagraphNode())
        }
      })
      initialValueRef.current = value
    }
  }, [editor, value, initialValueRef])

  return null
}

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
}: MarkdownEditorProps) {
  const initialValueRef = useRef(value)

  const initialConfig = {
    namespace: 'MarkdownEditor',
    editorState: () => {
      const root = $getRoot()
      if (value) {
        $convertFromMarkdownString(value, markdownTransformers, root, true)
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
        const markdown = $convertToMarkdownString(markdownTransformers)
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
