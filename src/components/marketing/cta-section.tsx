'use client'

import { ArrowRight, Plus, SearchSm } from '@untitled-ui/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function CtaSection() {
  return (
    <section className="border-t border-border/40 bg-muted/30 py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          Ready to build together?
        </h2>

        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Whether you&apos;re a founder who needs help or a contributor seeking
          real upside, there&apos;s a place for you here.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" className="h-12 gap-2 rounded-lg px-6" asChild>
            <Link href="/sign-up">
              <Plus className="size-4" />
              Create Your Project
              <ArrowRight className="animate-arrow-nudge size-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 gap-2 rounded-lg px-6"
            asChild
          >
            <Link href="/discover">
              <SearchSm className="size-4" />
              Find Work
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
