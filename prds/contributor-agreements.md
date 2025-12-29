# Contributor Agreements

## Overview

When contributors claim bounties on Shippy, they enter into a legal relationship with the project founder that involves:

- **IP assignment** — work product belongs to the project
- **Profit share acknowledgment** — understanding how payouts work
- **Independent contractor status** — not an employee
- **Representations** — originality of work, authority to assign

Currently, the platform ToS (Section 7.3) punts this to users: "Project owners and contributors are responsible for agreeing on IP and usage rights." But there's no mechanism to facilitate this.

This PRD outlines a system where:

1. Shippy provides a **standard Contributor Agreement template** that covers the basics
2. Founders can optionally add **project-specific terms**
3. Contributors must **accept the agreement** before their first claim on a project
4. Acceptance is **recorded and timestamped** for audit/legal purposes

---

## Goals

1. **Reduce founder friction** — every founder needs this, so make it easy with sensible defaults
2. **Protect contributors** — clear terms up front, no surprises
3. **Legal defensibility** — proper acceptance records if disputes arise
4. **Platform positioning** — Shippy isn't a party, but we facilitate the agreement

---

## User Stories

### Founder

> As a founder, I want contributors to agree to IP assignment and profit share terms before working on my bounties, so I have legal clarity on ownership of work product.

### Contributor

> As a contributor, I want to know what I'm agreeing to before claiming a bounty, so I can make an informed decision about participating.

### Platform

> As the platform, I want to facilitate (but not be party to) project-specific agreements, and maintain records of acceptance for transparency.

---

## Design

### 1. Standard Contributor Agreement (Platform Template)

Shippy provides a base template that covers the essentials. This is the default for all projects.

**Key provisions:**

1. **IP Assignment / Work Made for Hire**
   - All work product created for approved bounties is assigned to the project owner
   - Contributor waives moral rights where applicable
   - Contributor represents they have authority to assign and work is original
   - Explicit treatment of **background/pre-existing IP** (contributor keeps it; grants project a license to use it as incorporated)
   - Explicit treatment of **third-party/OSS materials** (contributor must comply with licenses and pass through required notices)
   - Fallback: if assignment is not effective in a jurisdiction, contributor grants a broad license sufficient for the project to use/commercialize the work

2. **Profit Share Acknowledgment**
   - Points are earned upon submission approval
   - Payouts are based on the founder's reported profits
   - Payouts are made via Shippy’s payout rails (e.g., Stripe Connect), initiated by the project owner
   - No minimum payout is guaranteed
   - Clear explanation of **pool capacity / dilution** (capacity expansion can reduce percentage share; logged publicly)
   - Points are **not equity / not securities** and do not create ownership in the founder or the platform
   - Founder may modify pool terms with notice (as allowed by Shippy’s project settings and audit trail)

3. **Independent Contractor Status**
   - Contributor is not an employee of the project or Shippy
   - Contributor is responsible for their own taxes, insurance, etc.
   - No exclusivity — can work on other projects
   - No partnership / joint venture / agency created by participation

4. **Confidentiality** (light version)
   - Don't share non-public project information without permission
   - Doesn't apply to work made public by the project
   - Optionally supports a stricter NDA addendum (project toggle)

5. **Representations & Warranties**
   - Work is original and doesn't infringe third-party rights
   - Contributor has authority to enter into this agreement
   - Work will be performed in a professional manner
   - Contributor is not violating obligations to a current/past employer or other third parties (common “no conflicting obligations” representation)

6. **Limitation of Liability**
   - Standard mutual limitations
   - Reference to platform ToS

7. **Termination**
   - Either party can terminate participation
   - Approved work/points survive termination

8. **Portfolio / Attribution (default-friendly)**
   - Contributor can reference their participation and show non-confidential work product in a portfolio once it’s public (or with founder permission)
   - Founder/project can publicly attribute work to contributor’s username (consistent with Shippy’s transparency model)

9. **Dispute Handling (between founder and contributor)**
   - Clear statement that disputes about approval, points, profit reporting, and payouts are between users (consistent with `/legal/terms.md`)
   - Optional governing law + venue or arbitration clause at the project level (founder-configurable)

10. **Electronic Acceptance**

- Click-to-accept is intended as an electronic signature; acceptance record stored with timestamp + audit data

### 2. Project-Level Terms (Founder Customization)

Founders can optionally add project-specific terms that supplement the standard agreement.

**Options:**

- **Additional terms text** (markdown) — e.g., specific confidentiality for pre-launch work
- **Required acknowledgments** — e.g., "I agree to complete Stripe onboarding before receiving payouts"
- **NDA requirement** — toggle for stricter confidentiality
- **Jurisdiction** — specify governing law / forum (or arbitration) if different from default
- **Project owner identity** — legal name/entity + contact email presented in the agreement
- **Project owner representative (if entity)** — name + title of an authorized representative shown in the agreement (for clarity on who can bind the entity)
- **Portfolio permission policy** — default allow/deny + optional embargo until public launch
- **IP mode** — assignment (default) vs license-only (for jurisdictions/edge cases)
- **Tax/onboarding prompt** (optional) — Stripe Connect generally handles identity/tax onboarding; the agreement can require completing that onboarding before payouts

**Implementation:**

```prisma
model Project {
  // ... existing fields ...

  // Contributor agreement settings
  contributorTermsEnabled  Boolean @default(true) // Use standard template
  contributorTermsCustom   String? @db.Text       // Additional project-specific terms (markdown)
  contributorTermsVersion  Int     @default(1)    // Increment to require re-acceptance

  // Agreement metadata shown to contributors
  projectOwnerLegalName    String?               // Legal counterparty name (prefer entity): e.g., "Acme LLC"
  projectOwnerContactEmail String?               // e.g., "legal@acme.com"
  contributorTermsGoverningLaw String?           // e.g., "Delaware" / "England and Wales"

  // Optional: if projectOwnerLegalName is an entity, show the human binding it
  projectOwnerAuthorizedRepresentativeName  String? // e.g., "Jane Doe"
  projectOwnerAuthorizedRepresentativeTitle String? // e.g., "CEO"
}
```

### 3. Acceptance Flow

When a contributor tries to claim a bounty for the first time on a project:

1. **Check for existing acceptance**
   - Query the latest `ContributorAgreement` for this user + project (most recent `acceptedAt`)
   - If it exists and the accepted `standardTemplateVersion` + `projectTermsVersion` match the currently-required versions, allow claim

2. **Show agreement modal**
   - Display the standard template + any project-specific terms
   - Checkbox: "I have read and agree to these terms"
   - Checkbox: "I understand this is a binding legal agreement"
   - Button: "Accept & Claim Bounty"

3. **Record acceptance**
   - Create agreement acceptance record with timestamp, version(s), IP, user agent
   - Proceed with claim

**Data model:**

```prisma
/// Record of a contributor accepting a project's terms
model ContributorAgreement {
  id        String   @id @default(dbgenerated("nanoid()"))
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Versions at time of acceptance
  standardTemplateVersion Int
  projectTermsVersion     Int

  // Audit trail
  acceptedAt DateTime @default(now()) @db.Timestamptz(3)
  ipAddress  String?  // For audit purposes
  userAgent  String?  @db.Text

  // The actual terms accepted (snapshot for legal purposes)
  // IMPORTANT: store the full text (or canonical markdown) that was presented, not just "v1"
  termsSnapshot Json  // { standardMarkdown: "...", projectCustomMarkdown: "...", renderedMarkdown?: "...", metadata: {...} }
  termsHash     String // e.g., sha256 of canonicalized snapshot for integrity checks

  // Keep history across re-acceptance (audit trail); prevent duplicate accepts of the same effective terms.
  @@unique([projectId, userId, standardTemplateVersion, projectTermsVersion])
  @@index([projectId])
  @@index([userId])
  @@map("contributor_agreement")
}
```

### 4. Re-acceptance on Terms Change

When a founder updates project-specific terms:

1. Increment `contributorTermsVersion`
2. Existing contributors with older acceptance version must re-accept on next claim
3. Notify active contributors that terms have changed

**Edge case:** What about in-flight claims?

- Existing active claims continue under the terms accepted at claim time
- The snapshot in `ContributorAgreement` captures what was agreed to

### 4.1 Optional: Per-Bounty Addenda

To support Terms 7.3’s “additional terms as a condition of accepting a submission or awarding points”, allow a bounty to define an **addendum** (extra terms / required checkboxes) that is accepted **at claim time** (or before submission) and snapshotted separately.

This avoids making a project-wide agreement overly broad for the majority of bounties.

### 5. Agreement Visibility

**For contributors:**

- View accepted terms on project page (under "Your Activity" or similar)
- Download PDF of accepted agreement

**For founders:**

- View list of contributors who have accepted
- See acceptance dates and versions
- Export for records

---

## UI/UX

### Claim Flow (Contributor)

```
[Claim Bounty Button clicked]
         ↓
[Has user accepted this project's terms?]
    ├── Yes + current version → Proceed to claim
    └── No or outdated version → Show Agreement Modal
                                        ↓
                              [Agreement Modal]
                              ┌─────────────────────────────────┐
                              │ Contributor Agreement           │
                              │ for [Project Name]              │
                              │                                 │
                              │ ┌─────────────────────────────┐ │
                              │ │ [Standard Terms - scrollable│ │
                              │ │  or accordion sections]     │ │
                              │ └─────────────────────────────┘ │
                              │                                 │
                              │ Additional Project Terms:       │
                              │ ┌─────────────────────────────┐ │
                              │ │ [Custom markdown terms]     │ │
                              │ └─────────────────────────────┘ │
                              │                                 │
                              │ ☐ I have read and agree to     │
                              │   these terms                   │
                              │ ☐ I understand this creates a   │
                              │   binding legal agreement       │
                              │                                 │
                              │ [Cancel]  [Accept & Claim]      │
                              └─────────────────────────────────┘
                                        ↓
                              [Create Agreement record]
                                        ↓
                              [Proceed with claim]
```

### Project Settings (Founder)

```
Settings > Contributor Agreement

┌─────────────────────────────────────────────────────────────┐
│ Contributor Agreement                                        │
│                                                              │
│ All contributors must accept this agreement before           │
│ claiming bounties on your project.                           │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ ☑ Use Shippy Standard Contributor Agreement              │ │
│ │   Covers IP assignment, profit share, independent        │ │
│ │   contractor status. [View template]                     │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ Additional Project Terms (optional):                         │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ [Markdown editor for custom terms]                       │ │
│ │                                                          │ │
│ │ Example: Pre-launch confidentiality, NDA language, etc. │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ ⚠️ Changing these terms will require existing contributors   │
│    to re-accept before their next claim.                     │
│                                                              │
│ [Save Changes]                                               │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│ Contributor Acceptances                                      │
│                                                              │
│ 12 contributors have accepted your terms                     │
│ [View All] [Export CSV]                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Standard Agreement Template

Single-template agreement (programmatically fillable placeholders):

- `legal/contributor-agreement-template.md`

This is a template only and should be reviewed by an attorney before use.

---

## MCP/API Considerations

### Claim Endpoint Changes

The `claimBounty` service/endpoint needs to:

1. Check for a valid `ContributorAgreement` acceptance (latest acceptance exists and matches the currently-required standard + project terms versions)
2. If missing or outdated, return error: `AGREEMENT_REQUIRED`
3. Client shows agreement modal
4. Client calls new `acceptContributorAgreement` endpoint
5. Client retries claim

**New endpoint:**

```typescript
// Accept contributor agreement for a project
acceptContributorAgreement({
  projectId: string
  checkboxes: {
    readAndAgree: boolean
    understandBinding: boolean
  }
  // IP and user agent captured server-side
})
```

### MCP Handling

For AI agents claiming via MCP:

- Return clear error message about agreement requirement
- Include link to project page where user can accept
- Optionally: MCP could accept on behalf of authenticated user if they've pre-authorized

---

## Migration

For existing projects and contributors:

1. **Default state:** All projects have `contributorTermsEnabled = true`, `contributorTermsVersion = 1`
2. **Existing claims:** No retroactive agreement required for completed bounties
3. **Active claims:** Contributors with active claims are grandfathered for that claim only
4. **New claims:** Require agreement acceptance going forward

---

## Open Questions

1. **Should Shippy be a party?** Current design has Shippy facilitating but not party to the agreement. This limits our liability but also our ability to enforce. Discuss with legal.

2. **Standard template versioning:** How do we handle updates to the Shippy standard template? Options:
   - All projects auto-upgrade (forces re-acceptance broadly)
   - Projects opt-in to new version
   - Grandfather existing, new projects get latest

3. **Founder entity:** Should we require founders to specify their legal entity (LLC, sole prop, etc.) for the agreement?
   - Default to requiring a **legal counterparty name** (entity preferred) and optionally a representative name/title for transparency.

4. **International considerations:** Different IP assignment rules in different countries. Should the agreement have jurisdiction-specific provisions?

5. **Witness/notarization:** For larger point values, should we require additional verification of agreement?

6. **Approval discretion:** Should the standard template specify that bounty approval is in the founder’s reasonable discretion (anchored to published acceptance criteria) to reduce disputes?

7. **Tax forms / withholding:** For payouts above thresholds, what responsibilities remain on founders vs what can be handled by Stripe Connect onboarding, and what (if anything) should Shippy store without collecting sensitive tax IDs?
   - With Stripe Connect handling most onboarding/tax collection, what (if anything) should Shippy store beyond payout status + non-sensitive identifiers?
   - Do we need a founder-facing “withholding responsibility” checklist (jurisdiction-dependent) without collecting sensitive tax IDs?

---

## Founder Process (Recommended MVP)

1. Founder connects payout rails for the project (e.g., Stripe Connect) and sets **Project Owner Identity** (legal name/entity + contact email) and optional governing law in project settings.
2. Founder reviews the **Standard Contributor Agreement template** and optionally adds **Project Terms** (markdown).
3. When a contributor claims their first bounty, Shippy presents a clickwrap with:
   - Standard template + project terms
   - (Optional) bounty addendum if the bounty requires it
4. Shippy records acceptance (timestamp, versions, terms snapshot, hash, IP/user agent) and makes it visible/exportable for both parties.

## Implementation Phases

### Phase 1: Core Infrastructure (MVP)

- [ ] Database schema for `ContributorAgreement`
- [ ] Project settings fields for terms customization
- [ ] Standard agreement template (static markdown)
- [ ] Claim flow: check for agreement, show modal, record acceptance
- [ ] Basic project settings UI for founders

### Phase 2: Enhanced UX

- [ ] Agreement modal with proper legal UX (scroll to bottom, checkboxes)
- [ ] PDF download of accepted agreement
- [ ] Founder dashboard for viewing acceptances
- [ ] Email notification when terms change

### Phase 3: Advanced Features

- [ ] Custom agreement templates (for enterprise/agency use cases)
- [ ] Agreement versioning with diff view
- [ ] Bulk re-acceptance campaigns
- [ ] Integration with e-signature providers (DocuSign, etc.)

---

## Success Metrics

- **Claim conversion:** % of users who complete agreement → claim (target: >90%)
- **Agreement completion time:** Average time to read and accept (<2 min target)
- **Founder adoption:** % of projects using custom terms
- **Dispute reduction:** Track disputes related to IP or payment terms

---

## References

- Platform Terms of Service: `/legal/terms.md` (especially Sections 5, 7.3, and 9)
- Privacy Policy: `/legal/privacy.md` (log data/IP address handling and retention expectations)
- Core PRD: `/prds/shippy.md` (especially Section 9: pool capacity + dilution)
- Prisma schema: `/prisma/schema.prisma`
- Claim service: `/src/server/services/bounty.ts`
