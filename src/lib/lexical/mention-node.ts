import {
  $applyNodeReplacement,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedTextNode,
  type Spread,
  TextNode,
} from 'lexical'

export type SerializedMentionNode = Spread<
  {
    username: string
  },
  SerializedTextNode
>

function $convertMentionElement(
  domNode: HTMLElement,
): DOMConversionOutput | null {
  const textContent = domNode.textContent
  if (textContent !== null) {
    // Extract username from @username format
    const username = textContent.startsWith('@')
      ? textContent.slice(1)
      : textContent
    const node = $createMentionNode(username)
    return { node }
  }
  return null
}

/**
 * MentionNode - A custom node for @mentions
 * Extends TextNode to inherit text behavior but with custom styling
 */
export class MentionNode extends TextNode {
  __username: string

  static getType(): string {
    return 'mention'
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__username, node.__key)
  }

  constructor(username: string, key?: NodeKey) {
    super(`@${username}`, key)
    this.__username = username
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config)
    dom.className = 'mention'
    dom.setAttribute('data-lexical-mention', 'true')
    dom.setAttribute('data-mention-username', this.__username)
    return dom
  }

  updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig): boolean {
    const isUpdated = super.updateDOM(prevNode, dom, config)
    if (prevNode.__username !== this.__username) {
      dom.setAttribute('data-mention-username', this.__username)
    }
    return isUpdated
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (domNode.hasAttribute('data-lexical-mention')) {
          return {
            conversion: $convertMentionElement,
            priority: 1,
          }
        }
        return null
      },
    }
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('span')
    element.setAttribute('data-lexical-mention', 'true')
    element.setAttribute('data-mention-username', this.__username)
    element.textContent = this.getTextContent()
    return { element }
  }

  static importJSON(serializedNode: SerializedMentionNode): MentionNode {
    const node = $createMentionNode(serializedNode.username)
    node.setFormat(serializedNode.format)
    node.setDetail(serializedNode.detail)
    node.setMode(serializedNode.mode)
    node.setStyle(serializedNode.style)
    return node
  }

  exportJSON(): SerializedMentionNode {
    return {
      ...super.exportJSON(),
      type: 'mention',
      username: this.__username,
    }
  }

  getUsername(): string {
    return this.__username
  }

  getTextContent(): string {
    return `@${this.__username}`
  }

  canInsertTextBefore(): boolean {
    return false
  }

  canInsertTextAfter(): boolean {
    return false
  }

  isTextEntity(): true {
    return true
  }
}

export function $createMentionNode(username: string): MentionNode {
  const mentionNode = new MentionNode(username)
  mentionNode.setMode('segmented').toggleDirectionless()
  return $applyNodeReplacement(mentionNode)
}

export function $isMentionNode(
  node: LexicalNode | null | undefined,
): node is MentionNode {
  return node instanceof MentionNode
}
