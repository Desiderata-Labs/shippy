import { createHeadlessEditorForTest } from './headless-editor'
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  HR,
  markdownTransformers,
} from './markdown-transformers'
import { HorizontalRuleNode } from '@lexical/extension'
import { createHeadlessEditor } from '@lexical/headless'
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html'
import { JSDOM } from 'jsdom'
import { $getRoot, $insertNodes } from 'lexical'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

let dom: JSDOM
let editor: ReturnType<typeof createHeadlessEditorForTest>

beforeEach(() => {
  dom = new JSDOM(`
    <!DOCTYPE html>
    <html><body><div id="editor-container"></div></body></html>
  `)
  global.document = dom.window.document
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.window = dom.window as any
  global.HTMLElement = dom.window.HTMLElement
  global.Element = dom.window.Element
  global.Node = dom.window.Node
  global.DOMParser = dom.window.DOMParser

  editor = createHeadlessEditorForTest()
})

afterEach(() => {
  editor.setEditable(false)
})

describe('Markdown Transformers', () => {
  describe('HR (Horizontal Rule) Transformer', () => {
    it('should import horizontal rule with ---', async () => {
      const markdown = '---'

      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown })
          resolve()
        })
      })

      const html = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve($generateHtmlFromNodes(editor))
        })
      })

      expect(html).toContain('<hr>')
    })

    it('should import horizontal rule with ***', async () => {
      const markdown = '***'

      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown })
          resolve()
        })
      })

      const html = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve($generateHtmlFromNodes(editor))
        })
      })

      expect(html).toContain('<hr>')
    })

    it('should import horizontal rule with ___', async () => {
      const markdown = '___'

      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown })
          resolve()
        })
      })

      const html = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve($generateHtmlFromNodes(editor))
        })
      })

      expect(html).toContain('<hr>')
    })

    it('should export horizontal rule as ***', async () => {
      const testEditor = createHeadlessEditor({
        nodes: [HorizontalRuleNode],
      })

      const html = '<hr>'

      await new Promise<void>((resolve) => {
        testEditor.update(() => {
          const parser = new DOMParser()
          const parsedDom = parser.parseFromString(html, 'text/html')
          const nodes = $generateNodesFromDOM(testEditor, parsedDom)
          $getRoot().select()
          $insertNodes(nodes)
          resolve()
        })
      })

      const markdown = await new Promise<string>((resolve) => {
        testEditor.getEditorState().read(() => {
          resolve($convertToMarkdownString({ transformers: [HR] }))
        })
      })

      expect(markdown).toBe('***')
    })
  })

  describe('Named Arguments Functions', () => {
    it('should use default transformers when not specified', async () => {
      const markdown = '# Heading\n\n**Bold text**'

      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown })
          resolve()
        })
      })

      const result = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve($convertToMarkdownString({}))
        })
      })

      expect(result).toContain('# Heading')
      expect(result).toContain('**Bold text**')
    })

    it('should preserve newlines by default', async () => {
      const markdown = 'Line 1\n\nLine 2'

      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown })
          resolve()
        })
      })

      const result = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve($convertToMarkdownString({}))
        })
      })

      expect(result).toContain('\n\n')
    })

    it('should respect shouldPreserveNewLines option', async () => {
      const markdown = 'Line 1\n\nLine 2'

      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({
            markdown,
            shouldPreserveNewLines: false,
          })
          resolve()
        })
      })

      const result = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve($convertToMarkdownString({ shouldPreserveNewLines: false }))
        })
      })

      expect(typeof result).toBe('string')
    })
  })

  describe('Round-trip Conversion', () => {
    const markdownExamples = [
      '# Test Heading\n\n## Sub Heading\n\nSome **bold** text',
      '## Notes\n\n1. **First** item\n2. **Second** item\n\n> A quote here',
      '### Tasks\n\n- Item one\n- Item two\n- Item with `code`',
      '# Document\n\n***\n\n## Section\n\nText with *emphasis*\n\n```\ncode block\n```',
    ]

    markdownExamples.forEach((markdown) => {
      it(`should preserve content in round-trip: "${markdown.substring(0, 30)}..."`, async () => {
        // Import markdown
        await new Promise<void>((resolve) => {
          editor.update(() => {
            $convertFromMarkdownString({ markdown })
            resolve()
          })
        })

        // Export back to markdown
        const exported = await new Promise<string>((resolve) => {
          editor.getEditorState().read(() => {
            resolve($convertToMarkdownString({}))
          })
        })

        // Import the exported markdown again
        const editor2 = createHeadlessEditorForTest()
        await new Promise<void>((resolve) => {
          editor2.update(() => {
            $convertFromMarkdownString({ markdown: exported })
            resolve()
          })
        })

        // Export again
        const secondExport = await new Promise<string>((resolve) => {
          editor2.getEditorState().read(() => {
            resolve($convertToMarkdownString({}))
          })
        })

        // The two exports should be identical
        expect(secondExport).toBe(exported)
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty markdown', async () => {
      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown: '' })
          resolve()
        })
      })

      const result = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve($convertToMarkdownString({}))
        })
      })

      expect(result).toBe('')
    })

    it('should handle malformed markdown gracefully', async () => {
      const malformedMarkdown = '# Incomplete\n**Unclosed bold\n- List item\n'

      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown: malformedMarkdown })
          resolve()
        })
      })

      const result = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve($convertToMarkdownString({}))
        })
      })

      // Should still contain the parseable parts
      expect(result).toContain('# Incomplete')
      expect(result).toContain('- List item')
    })

    it('should handle large documents efficiently', async () => {
      // Generate a large document
      const sections: string[] = []
      for (let i = 1; i <= 100; i++) {
        sections.push(`## Section ${i}`)
        sections.push(`**Title:** Item ${i}`)
        sections.push(`**Status:** Active`)
        sections.push(`**Plan:**`)
        sections.push(`1. Step one`)
        sections.push(`2. Step two`)
        sections.push('')
      }

      const largeDocument = sections.join('\n')
      const startTime = Date.now()

      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown: largeDocument })
          resolve()
        })
      })

      const processingTime = Date.now() - startTime

      const result = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve($convertToMarkdownString({}))
        })
      })

      // Should process efficiently (less than 2 seconds)
      expect(processingTime).toBeLessThan(2000)
      expect(result).toContain('## Section 1')
      expect(result).toContain('## Section 100')
    })
  })

  describe('Import Tests', () => {
    it('should import headings correctly', async () => {
      const markdown = '# Heading 1\n\n## Heading 2\n\n### Heading 3'

      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown })
          resolve()
        })
      })

      const html = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve($generateHtmlFromNodes(editor))
        })
      })

      expect(html).toContain('<h1')
      expect(html).toContain('<h2')
      expect(html).toContain('<h3')
    })

    it('should import text formatting correctly', async () => {
      const markdown = '**bold** and *italic* and ~~strikethrough~~ and `code`'

      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown })
          resolve()
        })
      })

      const html = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve($generateHtmlFromNodes(editor))
        })
      })

      expect(html).toContain('<strong')
      expect(html).toContain('<em')
      expect(html).toContain('<code')
    })

    it('should import lists correctly', async () => {
      const markdown = '- Item 1\n- Item 2\n- Item 3'

      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown })
          resolve()
        })
      })

      const html = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve($generateHtmlFromNodes(editor))
        })
      })

      expect(html).toContain('<ul')
      expect(html).toContain('<li')
    })

    it('should import ordered lists correctly', async () => {
      const markdown = '1. First\n2. Second\n3. Third'

      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown })
          resolve()
        })
      })

      const html = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve($generateHtmlFromNodes(editor))
        })
      })

      expect(html).toContain('<ol')
      expect(html).toContain('<li')
    })

    it('should import blockquotes correctly', async () => {
      const markdown = '> This is a quote'

      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown })
          resolve()
        })
      })

      const html = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve($generateHtmlFromNodes(editor))
        })
      })

      expect(html).toContain('<blockquote')
    })

    it('should import code blocks correctly', async () => {
      const markdown = '```\ncode here\n```'

      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown })
          resolve()
        })
      })

      const html = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve($generateHtmlFromNodes(editor))
        })
      })

      expect(html).toContain('<pre')
    })

    it('should import links correctly', async () => {
      const markdown = '[Link Text](https://example.com)'

      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown })
          resolve()
        })
      })

      const html = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve($generateHtmlFromNodes(editor))
        })
      })

      expect(html).toContain('<a')
      expect(html).toContain('href="https://example.com"')
    })
  })

  describe('MENTION Transformer', () => {
    it('should import @mention from markdown', async () => {
      const markdown = 'Hello @johndoe how are you?'

      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown })
          resolve()
        })
      })

      const html = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve($generateHtmlFromNodes(editor))
        })
      })

      // The mention should be in a span with mention class
      expect(html).toContain('data-lexical-mention')
      expect(html).toContain('@johndoe')
    })

    it('should export MentionNode as @username in markdown', async () => {
      const markdown = 'Check with @alice about this'

      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown })
          resolve()
        })
      })

      const result = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve($convertToMarkdownString({}))
        })
      })

      expect(result).toContain('@alice')
    })

    it('should round-trip mentions correctly', async () => {
      const markdown = 'Hey @rob and @jane, please review this'

      // Import
      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown })
          resolve()
        })
      })

      // Export
      const exported = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve($convertToMarkdownString({}))
        })
      })

      // Should contain both mentions
      expect(exported).toContain('@rob')
      expect(exported).toContain('@jane')

      // Import again to verify round-trip
      const editor2 = createHeadlessEditorForTest()
      await new Promise<void>((resolve) => {
        editor2.update(() => {
          $convertFromMarkdownString({ markdown: exported })
          resolve()
        })
      })

      const secondExport = await new Promise<string>((resolve) => {
        editor2.getEditorState().read(() => {
          resolve($convertToMarkdownString({}))
        })
      })

      expect(secondExport).toContain('@rob')
      expect(secondExport).toContain('@jane')
    })

    it('should handle mentions with underscores and hyphens', async () => {
      const markdown = 'Contact @user_name and @user-name'

      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown })
          resolve()
        })
      })

      const result = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve($convertToMarkdownString({}))
        })
      })

      expect(result).toContain('@user_name')
      expect(result).toContain('@user-name')
    })

    it('should handle mention at start of text', async () => {
      const markdown = '@admin please help'

      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown })
          resolve()
        })
      })

      const result = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve($convertToMarkdownString({}))
        })
      })

      expect(result).toContain('@admin')
    })

    it('should not match email addresses as mentions', async () => {
      const markdown = 'Email me at test@example.com'

      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown })
          resolve()
        })
      })

      const html = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve($generateHtmlFromNodes(editor))
        })
      })

      // Should not have a mention node for the email
      // The @ in email is part of the email, not a standalone mention
      expect(html).not.toContain('data-lexical-mention="true"')
    })
  })

  describe('Export Tests', () => {
    it('should export headings correctly', async () => {
      const markdown = '# Heading 1\n\n## Heading 2'

      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown })
          resolve()
        })
      })

      const result = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve(
            $convertToMarkdownString({ transformers: markdownTransformers }),
          )
        })
      })

      expect(result).toContain('# Heading 1')
      expect(result).toContain('## Heading 2')
    })

    it('should export lists correctly', async () => {
      const markdown = '- Item 1\n- Item 2'

      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown })
          resolve()
        })
      })

      const result = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve(
            $convertToMarkdownString({ transformers: markdownTransformers }),
          )
        })
      })

      expect(result).toContain('- Item 1')
      expect(result).toContain('- Item 2')
    })

    it('should export blockquotes correctly', async () => {
      const markdown = '> Quote text'

      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString({ markdown })
          resolve()
        })
      })

      const result = await new Promise<string>((resolve) => {
        editor.getEditorState().read(() => {
          resolve(
            $convertToMarkdownString({ transformers: markdownTransformers }),
          )
        })
      })

      expect(result).toContain('> Quote text')
    })
  })
})
