'use client'

import { trpc } from '@/lib/trpc/react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { $createMentionNode } from './mention-node'
import { mergeRegister } from '@lexical/utils'
import {
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
} from 'lexical'

export interface MentionMatch {
  matchingString: string
  replaceStart: number
  replaceEnd: number
}

/**
 * Checks if there's an @mention being typed at the current cursor position
 */
function getMentionMatch(
  text: string,
  cursorOffset: number,
): MentionMatch | null {
  // Look backward from cursor for @ symbol
  const textBeforeCursor = text.slice(0, cursorOffset)

  // Find the last @ symbol
  const atIndex = textBeforeCursor.lastIndexOf('@')

  if (atIndex === -1) {
    return null
  }

  // Check that @ is at start or preceded by whitespace
  if (atIndex > 0 && !/\s/.test(textBeforeCursor[atIndex - 1])) {
    return null
  }

  // Get the text after @ up to cursor
  const matchingString = textBeforeCursor.slice(atIndex + 1)

  // Make sure the matching string is valid (no spaces, etc.)
  if (!/^[a-zA-Z0-9_-]*$/.test(matchingString)) {
    return null
  }

  return {
    matchingString,
    replaceStart: atIndex,
    replaceEnd: cursorOffset,
  }
}

interface MentionUser {
  id: string
  name: string
  username: string | null
  image: string | null
}

export function MentionPlugin(): React.ReactElement | null {
  const [editor] = useLexicalComposerContext()
  const [mentionMatch, setMentionMatch] = useState<MentionMatch | null>(null)
  const [position, setPosition] = useState<{
    top: number
    left: number
  } | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const lastAtPositionRef = useRef<number | null>(null)
  const [anchorElem] = useState<HTMLElement | null>(() =>
    typeof document !== 'undefined' ? document.body : null,
  )

  // Debounce the search query
  const debouncedQuery = useDebounce(mentionMatch?.matchingString ?? '', 150)

  // Search users
  const { data: users = [] } = trpc.user.search.useQuery(
    { query: debouncedQuery },
    {
      enabled: debouncedQuery.length > 0 && mentionMatch !== null,
      staleTime: 30000, // Cache for 30 seconds
    },
  )

  const isOpen = mentionMatch !== null && users.length > 0

  // Clamp selected index to valid range
  const clampedIndex =
    users.length === 0 ? 0 : Math.min(selectedIndex, users.length - 1)

  // Handle text changes to detect @mentions
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection()

        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          setMentionMatch(null)
          setPosition(null)
          return
        }

        const anchorNode = selection.anchor.getNode()

        if (!$isTextNode(anchorNode)) {
          setMentionMatch(null)
          setPosition(null)
          return
        }

        const textContent = anchorNode.getTextContent()
        const cursorOffset = selection.anchor.offset

        const match = getMentionMatch(textContent, cursorOffset)

        if (match) {
          // Only update position when starting a new mention (not while typing)
          const isNewMention = lastAtPositionRef.current !== match.replaceStart

          setMentionMatch(match)

          if (isNewMention) {
            lastAtPositionRef.current = match.replaceStart

            // Calculate position anchored to the @ symbol
            const nativeSelection = window.getSelection()
            if (nativeSelection && nativeSelection.rangeCount > 0) {
              const range = nativeSelection.getRangeAt(0)

              // Create a range at the @ position
              const atRange = document.createRange()
              const textNode = range.startContainer

              if (textNode.nodeType === Node.TEXT_NODE) {
                // Set range to start at the @ symbol
                const atOffset = match.replaceStart
                atRange.setStart(textNode, atOffset)
                atRange.setEnd(textNode, atOffset + 1) // Just the @ character

                const rect = atRange.getBoundingClientRect()
                setPosition({
                  top: rect.bottom + 4,
                  left: rect.left,
                })
              }
            }
          }
        } else {
          lastAtPositionRef.current = null
          setMentionMatch(null)
          setPosition(null)
        }
      })
    })
  }, [editor])

  // Insert the mention
  const insertMention = useCallback(
    (user: MentionUser) => {
      if (!mentionMatch) return
      if (!user.username) return

      editor.update(() => {
        const selection = $getSelection()

        if (!$isRangeSelection(selection)) return

        const anchorNode = selection.anchor.getNode()

        if (!$isTextNode(anchorNode)) return

        const textContent = anchorNode.getTextContent()
        const before = textContent.slice(0, mentionMatch.replaceStart)
        const after = textContent.slice(mentionMatch.replaceEnd)

        // Split: text before + mention node + space + text after
        const username = user.username as string // Already verified non-null above
        const mentionNode = $createMentionNode(username)
        const spaceNode = $createTextNode(' ')

        // Replace the current text node with before text
        if (before) {
          const beforeNode = $createTextNode(before)
          anchorNode.replace(beforeNode)
          beforeNode.insertAfter(mentionNode)
          mentionNode.insertAfter(spaceNode)
          if (after) {
            const afterNode = $createTextNode(after)
            spaceNode.insertAfter(afterNode)
          }
        } else {
          anchorNode.replace(mentionNode)
          mentionNode.insertAfter(spaceNode)
          if (after) {
            const afterNode = $createTextNode(after)
            spaceNode.insertAfter(afterNode)
          }
        }

        // Move cursor to after the space
        spaceNode.selectEnd()
      })

      setMentionMatch(null)
      setPosition(null)
    },
    [editor, mentionMatch],
  )

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    return mergeRegister(
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          event.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % users.length)
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          event.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + users.length) % users.length)
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          event?.preventDefault()
          const selectedUser = users[clampedIndex]
          if (selectedUser) {
            insertMention(selectedUser)
          }
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_TAB_COMMAND,
        (event) => {
          event.preventDefault()
          const selectedUser = users[clampedIndex]
          if (selectedUser) {
            insertMention(selectedUser)
          }
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          setMentionMatch(null)
          setPosition(null)
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
    )
  }, [editor, isOpen, users, clampedIndex, insertMention])

  if (!anchorElem || !isOpen || !position) {
    return null
  }

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 max-h-64 min-w-[200px] overflow-auto rounded-lg border bg-popover p-1 shadow-md"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {users.map((user, index) => (
        <button
          key={user.id}
          type="button"
          className={cn(
            'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm',
            index === clampedIndex
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-accent/50',
          )}
          onClick={() => insertMention(user)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <Avatar className="size-6">
            <AvatarImage src={user.image ?? undefined} />
            <AvatarFallback className="text-xs">
              {user.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start">
            <span className="font-medium">{user.name}</span>
            {user.username && (
              <span className="text-xs text-muted-foreground">
                @{user.username}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>,
    anchorElem,
  )
}
