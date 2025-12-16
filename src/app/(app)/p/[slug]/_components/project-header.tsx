'use client'

import {
  CheckCircle,
  DotsVertical,
  Edit01,
  Grid01,
  Share07,
} from '@untitled-ui/icons-react'
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { routes } from '@/lib/routes'
import { AppButton } from '@/components/app'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ProjectHeaderProps {
  project: {
    id: string
    slug: string
    name: string
    logoUrl: string | null
    founder: {
      id: string
      name: string
      username: string | null
      image: string | null
    }
  }
  isFounder: boolean
}

export function ProjectHeader({ project, isFounder }: ProjectHeaderProps) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = `${window.location.origin}${routes.project.detail({ slug: project.slug })}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mb-6 space-y-4">
      {/* Breadcrumb-style header: user / project */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          {/* Breadcrumb: {user icon} {username} / {app icon} {app name} */}
          <div className="flex items-center gap-1.5 text-sm sm:text-base">
            {/* Founder */}
            {project.founder.username ? (
              <Link
                href={routes.user.profile({
                  username: project.founder.username,
                })}
                className="flex items-center gap-1.5"
              >
                <Avatar className="size-5 ring-1 ring-border">
                  <AvatarImage src={project.founder.image ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {project.founder.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{project.founder.username}</span>
              </Link>
            ) : (
              <div className="flex items-center gap-1.5">
                <Avatar className="size-5 ring-1 ring-border">
                  <AvatarImage src={project.founder.image ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {project.founder.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{project.founder.name}</span>
              </div>
            )}

            {/* Separator */}
            <span className="text-muted-foreground/50">/</span>

            {/* Project */}
            <div className="flex items-center gap-1.5">
              {project.logoUrl ? (
                <Image
                  src={project.logoUrl}
                  alt={project.name}
                  width={20}
                  height={20}
                  className="size-5 rounded-sm object-cover ring-1 ring-border"
                />
              ) : (
                <div className="flex size-5 items-center justify-center rounded-sm bg-muted text-xs font-bold">
                  {project.name.charAt(0).toUpperCase()}
                </div>
              )}
              <h1 className="font-semibold text-foreground">{project.name}</h1>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <AppButton
                  variant="outline"
                  size="sm"
                  className="size-8 cursor-pointer border-border bg-secondary p-0 hover:bg-accent"
                  onClick={handleShare}
                >
                  {copied ? (
                    <CheckCircle className="size-3.5 text-primary" />
                  ) : (
                    <Share07 className="size-3.5" />
                  )}
                </AppButton>
              </TooltipTrigger>
              <TooltipContent>
                {copied ? 'Copied!' : 'Share project'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {isFounder && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <AppButton
                  variant="outline"
                  size="sm"
                  className="size-8 cursor-pointer border-border bg-secondary p-0 hover:bg-accent"
                >
                  <DotsVertical className="size-4" />
                </AppButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href={routes.project.settings({ slug: project.slug })}>
                    <Edit01 className="mr-2 size-4" />
                    Edit project
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link
                    href={routes.project.integrations({ slug: project.slug })}
                  >
                    <Grid01 className="mr-2 size-4" />
                    Integrations
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  )
}
