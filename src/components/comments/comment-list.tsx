'use client'

import { DotsVertical, Trash01 } from '@untitled-ui/icons-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Markdown } from '@/components/ui/markdown'

interface Comment {
  id: string
  content: string
  createdAt: Date | string
  user: {
    id: string
    name: string
    image: string | null
  }
}

interface CommentListProps {
  comments: Comment[]
  currentUserId?: string
  isFounder?: boolean
  onDeleteClick: (commentId: string) => void
}

export function CommentList({
  comments,
  currentUserId,
  isFounder = false,
  onDeleteClick,
}: CommentListProps) {
  if (comments.length === 0) return null

  return (
    <div className="space-y-4 pb-4">
      {comments.map((comment) => {
        const canDelete = comment.user.id === currentUserId || isFounder

        return (
          <div key={comment.id} className="group">
            <div className="flex items-start gap-3">
              <Avatar className="size-7 shrink-0">
                <AvatarImage src={comment.user.image ?? undefined} />
                <AvatarFallback className="text-xs">
                  {comment.user.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {comment.user.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <Markdown
                  markdown={comment.content}
                  proseSize="sm"
                  className="mt-1"
                />
              </div>
              {canDelete && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="cursor-pointer rounded-sm p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent hover:text-foreground"
                    >
                      <DotsVertical className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => onDeleteClick(comment.id)}
                      className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <Trash01 className="mr-2 size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
