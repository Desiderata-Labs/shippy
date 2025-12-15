import { editorTheme } from './editor-theme'
import { MentionNode } from './mention-node'
import { CodeHighlightNode, CodeNode } from '@lexical/code'
import { HorizontalRuleNode } from '@lexical/extension'
import { createHeadlessEditor } from '@lexical/headless'
import { AutoLinkNode, LinkNode } from '@lexical/link'
import { ListItemNode, ListNode } from '@lexical/list'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'

/**
 * Editor configuration matching the main markdown-editor
 */
export const editorConfig = {
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
  theme: editorTheme,
}

interface HeadlessEditorProps {
  initialState?: string
}

/**
 * Creates a headless Lexical editor for testing purposes.
 * This editor has the same configuration as the main markdown-editor.
 */
export const createHeadlessEditorForTest = ({
  initialState,
}: HeadlessEditorProps = {}) => {
  const editor = createHeadlessEditor({
    nodes: editorConfig.nodes,
    theme: editorConfig.theme,
    onError: (error: Error) => {
      throw error
    },
  })

  if (initialState) {
    const state = editor.parseEditorState(initialState)
    if (state) {
      editor.setEditorState(state)
    }
  }

  return editor
}
