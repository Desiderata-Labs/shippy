/**
 * Markdown Transformers for Lexical Editor
 * Provides import/export functionality with proper newline preservation
 */
import { $createMentionNode, $isMentionNode, MentionNode } from './mention-node'
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
} from '@lexical/extension'
import {
  CHECK_LIST,
  ELEMENT_TRANSFORMERS,
  MULTILINE_ELEMENT_TRANSFORMERS,
  TEXT_FORMAT_TRANSFORMERS,
  TEXT_MATCH_TRANSFORMERS,
  $convertFromMarkdownString as lexicalConvertFromMarkdown,
  $convertToMarkdownString as lexicalConvertToMarkdown,
} from '@lexical/markdown'
import type {
  ElementTransformer,
  TextMatchTransformer,
  Transformer,
} from '@lexical/markdown'
import type { ElementNode, LexicalNode } from 'lexical'

/**
 * Horizontal rule transformer - supports ---, ***, and ___
 */
export const HR: ElementTransformer = {
  dependencies: [HorizontalRuleNode],
  export: (node: LexicalNode) => {
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

/**
 * Mention transformer - converts @username to MentionNode and back
 */
export const MENTION: TextMatchTransformer = {
  dependencies: [MentionNode],
  export: (node: LexicalNode) => {
    if (!$isMentionNode(node)) {
      return null
    }
    return `@${node.getUsername()}`
  },
  importRegExp: /(?:^|(?<=\s))@([a-zA-Z0-9_-]+)/,
  regExp: /(?:^|(?<=\s))@([a-zA-Z0-9_-]+)$/,
  replace: (textNode, match) => {
    const username = match[1]
    const mentionNode = $createMentionNode(username)
    textNode.replace(mentionNode)
  },
  trigger: ' ',
  type: 'text-match',
}

/**
 * Combined transformers for convenience - matches playground structure
 */
export const markdownTransformers: Array<Transformer> = [
  HR,
  CHECK_LIST,
  MENTION,
  ...ELEMENT_TRANSFORMERS,
  ...MULTILINE_ELEMENT_TRANSFORMERS,
  ...TEXT_FORMAT_TRANSFORMERS,
  ...TEXT_MATCH_TRANSFORMERS,
]

/**
 * Options for converting from markdown string
 */
interface ConvertFromMarkdownOptions {
  markdown: string
  transformers?: Array<Transformer>
  node?: ElementNode
  shouldPreserveNewLines?: boolean
  shouldMergeAdjacentLines?: boolean
}

/**
 * Options for converting to markdown string
 */
interface ConvertToMarkdownOptions {
  transformers?: Array<Transformer>
  node?: ElementNode
  shouldPreserveNewLines?: boolean
}

/**
 * Renders markdown from a string. The selection is moved to the start after the operation.
 * Uses named arguments for better readability and maintainability.
 */
export function $convertFromMarkdownString({
  markdown,
  transformers = markdownTransformers,
  node,
  shouldPreserveNewLines = true,
  shouldMergeAdjacentLines = false,
}: ConvertFromMarkdownOptions): void {
  return lexicalConvertFromMarkdown(
    markdown,
    transformers,
    node,
    shouldPreserveNewLines,
    shouldMergeAdjacentLines,
  )
}

/**
 * Renders string from markdown. The selection is moved to the start after the operation.
 * Uses named arguments for better readability and maintainability.
 */
export function $convertToMarkdownString({
  transformers = markdownTransformers,
  node,
  shouldPreserveNewLines = true,
}: ConvertToMarkdownOptions = {}): string {
  return lexicalConvertToMarkdown(transformers, node, shouldPreserveNewLines)
}
