'use client'

import { trpc } from '@/lib/trpc/react'
import { Bell01 } from '@untitled-ui/icons-react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { NotificationType } from '@/lib/db/types'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { formatDistanceToNow } from 'date-fns'

/**
 * Get a human-readable description of the notification
 */
function getNotificationDescription(
  type: string,
  actorName: string,
  referenceTitle: string | null,
): string {
  const title = referenceTitle ?? 'a bounty'

  switch (type) {
    // Comments
    case NotificationType.BOUNTY_COMMENT:
      return `${actorName} commented on "${title}"`
    case NotificationType.SUBMISSION_COMMENT:
      return `${actorName} commented on a submission for "${title}"`

    // Mentions
    case NotificationType.BOUNTY_MENTION:
      return `${actorName} mentioned you in "${title}"`
    case NotificationType.SUBMISSION_MENTION:
      return `${actorName} mentioned you in a submission for "${title}"`

    // Submissions
    case NotificationType.SUBMISSION_CREATED:
      return `${actorName} submitted work for "${title}"`
    case NotificationType.SUBMISSION_APPROVED:
      return `Your submission for "${title}" was approved`
    case NotificationType.SUBMISSION_REJECTED:
      return `Your submission for "${title}" was not accepted`
    case NotificationType.SUBMISSION_NEEDS_INFO:
      return `${actorName} requested more info on your submission`

    // Claims
    case NotificationType.BOUNTY_CLAIMED:
      return `${actorName} claimed "${title}"`
    case NotificationType.CLAIM_EXPIRED:
      return `Your claim on "${title}" has expired`

    // Payouts
    case NotificationType.PAYOUT_ANNOUNCED:
      return `A payout has been announced`
    case NotificationType.PAYOUT_SENT:
      return `Your payout has been marked as sent`
    case NotificationType.PAYOUT_CONFIRMED:
      return `${actorName} confirmed receipt of payout`
    case NotificationType.PAYOUT_DISPUTED:
      return `${actorName} disputed a payout`

    default:
      return `${actorName} did something`
  }
}

export function NotificationPopover() {
  const [isOpen, setIsOpen] = useState(false)

  // Fetch unread count
  const { data: unreadData, refetch: refetchUnread } =
    trpc.notification.unreadCount.useQuery(undefined, {
      refetchInterval: 30000, // Poll every 30 seconds
    })

  // Fetch notifications list (only when popover is open)
  const {
    data: notifications,
    refetch: refetchNotifications,
    isLoading,
  } = trpc.notification.list.useQuery(undefined, {
    enabled: isOpen,
  })

  // Mark all as read mutation
  const markAllReadMutation = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      refetchUnread()
    },
  })

  // Mark as read when popover opens
  useEffect(() => {
    if (isOpen && unreadData && unreadData.count > 0) {
      markAllReadMutation.mutate()
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch notifications when popover opens
  useEffect(() => {
    if (isOpen) {
      refetchNotifications()
    }
  }, [isOpen, refetchNotifications])

  const unreadCount = unreadData?.count ?? 0

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative cursor-pointer rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell01 className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 border-border bg-background/95 p-0 backdrop-blur-xl"
      >
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-medium">Notifications</h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="size-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          ) : notifications && notifications.length > 0 ? (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onNavigate={() => setIsOpen(false)}
                />
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface NotificationItemProps {
  notification: {
    id: string
    type: string
    readAt: Date | null
    createdAt: Date
    referenceTitle: string | null
    referenceUrl: string | null
    actor: {
      id: string
      name: string
      image: string | null
      username: string | null
    }
  }
  onNavigate: () => void
}

function NotificationItem({ notification, onNavigate }: NotificationItemProps) {
  const isUnread = notification.readAt === null
  const description = getNotificationDescription(
    notification.type,
    notification.actor.name,
    notification.referenceTitle,
  )

  const content = (
    <div
      className={cn(
        'flex gap-2 px-4 py-3 transition-colors hover:bg-accent/50',
        isUnread && 'bg-accent/30',
      )}
    >
      {/* Unread indicator - centered with avatar */}
      <div className="flex h-6 w-2 shrink-0 items-center justify-center">
        {isUnread && <div className="size-1.5 rounded-full bg-primary" />}
      </div>

      {/* Avatar */}
      <Avatar className="size-6 shrink-0">
        <AvatarImage src={notification.actor.image ?? undefined} />
        <AvatarFallback className="text-[10px]">
          {notification.actor.name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">{description}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(notification.createdAt), {
            addSuffix: true,
          })}
        </p>
      </div>
    </div>
  )

  if (notification.referenceUrl) {
    return (
      <Link
        href={notification.referenceUrl}
        onClick={onNavigate}
        className="block"
      >
        {content}
      </Link>
    )
  }

  return content
}
