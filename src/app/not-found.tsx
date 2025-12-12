import { AppBackground } from '@/components/layout/app-background'
import { NotFoundState } from '@/components/ui/not-found-state'

export default function NotFound() {
  return (
    <AppBackground>
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4">
        <NotFoundState />
      </div>
    </AppBackground>
  )
}
