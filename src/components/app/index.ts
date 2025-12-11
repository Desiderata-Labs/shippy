/**
 * App-styled components that extend shadcn/ui components with minimal CSS overrides
 * to match the landing page aesthetic (rounded corners, subtle borders).
 *
 * Use these instead of base shadcn components for app pages to:
 * 1. Maintain consistent styling across the app
 * 2. Prevent shadcn updates from overwriting custom styles
 */

export {
  AppCard,
  AppCardHeader,
  AppCardTitle,
  AppCardDescription,
  AppCardContent,
  AppCardFooter,
} from './app-card'
export { AppButton, appButtonVariants } from './app-button'
export { AppInput } from './app-input'
export { AppTextarea } from './app-textarea'
