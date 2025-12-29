'use client'

import { File01, Scale01, Users01 } from '@untitled-ui/icons-react'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { CONTRIBUTOR_AGREEMENT_TEMPLATE_VERSION } from '@/lib/db/types'
import { cn } from '@/lib/utils'
import { AppInput } from '@/components/app'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface ContributorAgreementSettingsValue {
  contributorTermsEnabled: boolean
  contributorTermsCustom: string
  projectOwnerLegalName: string
  projectOwnerContactEmail: string
  contributorTermsGoverningLaw: string
  projectOwnerAuthorizedRepresentativeName: string
  projectOwnerAuthorizedRepresentativeTitle: string
}

interface ContributorAgreementSettingsProps {
  value: ContributorAgreementSettingsValue
  onChange: (value: ContributorAgreementSettingsValue) => void
  disabled?: boolean
  /** If true, show a compact version suitable for sidebars */
  compact?: boolean
  /** Show warning about re-acceptance when terms change */
  showVersionWarning?: boolean
  /** Current terms version (for display) */
  currentVersion?: number
  /** Number of contributors who have accepted */
  acceptedCount?: number
  /** If true, hide the enable/disable toggle (agreement is always required) */
  hideToggle?: boolean
}

export function ContributorAgreementSettings({
  value,
  onChange,
  disabled = false,
  compact = false,
  showVersionWarning = false,
  currentVersion = 1,
  acceptedCount,
  hideToggle = false,
}: ContributorAgreementSettingsProps) {
  const [isOpen, setIsOpen] = useState(!compact)

  if (compact) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between py-2 text-left">
          <div className="flex items-center gap-2">
            <Scale01 className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Contributor Agreement
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-xs',
                value.contributorTermsEnabled
                  ? 'text-primary'
                  : 'text-muted-foreground',
              )}
            >
              {value.contributorTermsEnabled ? 'Enabled' : 'Disabled'}
            </span>
            <ChevronDown
              className={cn(
                'size-4 text-muted-foreground transition-transform',
                isOpen && 'rotate-180',
              )}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <CompactSettings
            value={value}
            onChange={onChange}
            disabled={disabled}
            showVersionWarning={showVersionWarning}
            currentVersion={currentVersion}
            acceptedCount={acceptedCount}
            hideToggle={hideToggle}
          />
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return (
    <div className="space-y-4">
      <FullSettings
        value={value}
        onChange={onChange}
        disabled={disabled}
        showVersionWarning={showVersionWarning}
        currentVersion={currentVersion}
        acceptedCount={acceptedCount}
        hideToggle={hideToggle}
      />
    </div>
  )
}

function CompactSettings({
  value,
  onChange,
  disabled,
  showVersionWarning,
  currentVersion,
  acceptedCount,
  hideToggle,
}: Omit<ContributorAgreementSettingsProps, 'compact'> & {
  value: ContributorAgreementSettingsValue
}) {
  const updateValue = <K extends keyof ContributorAgreementSettingsValue>(
    key: K,
    newValue: ContributorAgreementSettingsValue[K],
  ) => {
    onChange({ ...value, [key]: newValue })
  }

  return (
    <>
      {/* Enable toggle (hidden when hideToggle is true) */}
      {!hideToggle && (
        <div className="flex items-center justify-between">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help text-xs text-muted-foreground">
                Require agreement
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Contributors must accept legal terms before claiming bounties
            </TooltipContent>
          </Tooltip>
          <Switch
            checked={value.contributorTermsEnabled}
            onCheckedChange={(checked) =>
              updateValue('contributorTermsEnabled', checked)
            }
            disabled={disabled}
          />
        </div>
      )}

      {value.contributorTermsEnabled && (
        <>
          {/* Legal name */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Legal entity name
            </label>
            <AppInput
              value={value.projectOwnerLegalName}
              onChange={(e) =>
                updateValue('projectOwnerLegalName', e.target.value)
              }
              placeholder="Your LLC or company name"
              disabled={disabled}
              className="h-8 text-xs"
            />
          </div>

          {/* Contact email */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Legal contact email
            </label>
            <AppInput
              type="email"
              value={value.projectOwnerContactEmail}
              onChange={(e) =>
                updateValue('projectOwnerContactEmail', e.target.value)
              }
              placeholder="legal@yourcompany.com"
              disabled={disabled}
              className="h-8 text-xs"
            />
          </div>

          {/* Stats */}
          {acceptedCount !== undefined && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users01 className="size-3" />
              <span>
                {acceptedCount} contributor{acceptedCount !== 1 ? 's' : ''}{' '}
                accepted
              </span>
            </div>
          )}

          {/* Version info */}
          <div className="text-xs text-muted-foreground">
            Template v{CONTRIBUTOR_AGREEMENT_TEMPLATE_VERSION} • Project terms v
            {currentVersion}
          </div>

          {showVersionWarning && (
            <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
              Changing terms will require re-acceptance
            </div>
          )}
        </>
      )}
    </>
  )
}

function FullSettings({
  value,
  onChange,
  disabled,
  showVersionWarning,
  currentVersion,
  acceptedCount,
  hideToggle,
}: Omit<ContributorAgreementSettingsProps, 'compact'> & {
  value: ContributorAgreementSettingsValue
}) {
  const updateValue = <K extends keyof ContributorAgreementSettingsValue>(
    key: K,
    newValue: ContributorAgreementSettingsValue[K],
  ) => {
    onChange({ ...value, [key]: newValue })
  }

  return (
    <div className="rounded-lg border border-border bg-accent">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Scale01 className="size-4 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-medium">Contributor Agreement</h3>
            <p className="text-xs text-muted-foreground">
              {hideToggle
                ? 'Required for all projects'
                : 'Legal terms contributors must accept before claiming bounties'}
            </p>
          </div>
        </div>
        {!hideToggle && (
          <Switch
            checked={value.contributorTermsEnabled}
            onCheckedChange={(checked) =>
              updateValue('contributorTermsEnabled', checked)
            }
            disabled={disabled}
          />
        )}
      </div>

      {value.contributorTermsEnabled && (
        <>
          <Separator />

          {/* Legal entity info */}
          <div className="space-y-4 px-4 py-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Legal entity name *
                </label>
                <AppInput
                  value={value.projectOwnerLegalName}
                  onChange={(e) =>
                    updateValue('projectOwnerLegalName', e.target.value)
                  }
                  placeholder="Acme LLC"
                  disabled={disabled}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  The legal name that will appear on the agreement
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Contact email *
                </label>
                <AppInput
                  type="email"
                  value={value.projectOwnerContactEmail}
                  onChange={(e) =>
                    updateValue('projectOwnerContactEmail', e.target.value)
                  }
                  placeholder="legal@acme.com"
                  disabled={disabled}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  For legal notices and communications
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Authorized representative (optional)
                </label>
                <AppInput
                  value={value.projectOwnerAuthorizedRepresentativeName}
                  onChange={(e) =>
                    updateValue(
                      'projectOwnerAuthorizedRepresentativeName',
                      e.target.value,
                    )
                  }
                  placeholder="Jane Doe"
                  disabled={disabled}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Title (optional)
                </label>
                <AppInput
                  value={value.projectOwnerAuthorizedRepresentativeTitle}
                  onChange={(e) =>
                    updateValue(
                      'projectOwnerAuthorizedRepresentativeTitle',
                      e.target.value,
                    )
                  }
                  placeholder="CEO"
                  disabled={disabled}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Governing law (optional)
              </label>
              <AppInput
                value={value.contributorTermsGoverningLaw}
                onChange={(e) =>
                  updateValue('contributorTermsGoverningLaw', e.target.value)
                }
                placeholder="the Commonwealth of Pennsylvania"
                disabled={disabled}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Defaults to &quot;the Commonwealth of Pennsylvania&quot; if not
                specified
              </p>
            </div>
          </div>

          <Separator />

          {/* Custom terms */}
          <div className="space-y-2 px-4 py-3">
            <div className="flex items-center gap-2">
              <File01 className="size-4 text-muted-foreground" />
              <label className="text-xs font-medium text-muted-foreground">
                Additional project-specific terms (optional)
              </label>
            </div>
            <MarkdownEditor
              value={value.contributorTermsCustom}
              onChange={(v) => updateValue('contributorTermsCustom', v)}
              placeholder="Add any project-specific terms, NDA language, or special requirements..."
              disabled={disabled}
              minHeight="80px"
              contentClassName="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              These will be shown verbatim in addition to the standard Shippy
              contributor agreement template.
            </p>
          </div>

          <Separator />

          {/* Info footer */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                Template v{CONTRIBUTOR_AGREEMENT_TEMPLATE_VERSION} • Project
                terms v{currentVersion}
              </span>
              {acceptedCount !== undefined && (
                <span className="flex items-center gap-1">
                  <Users01 className="size-3" />
                  {acceptedCount} accepted
                </span>
              )}
            </div>
          </div>

          {showVersionWarning && (
            <div className="border-t border-amber-500/20 bg-amber-500/10 px-4 py-2">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                ⚠️ Changing these terms will require existing contributors to
                re-accept before their next claim.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
