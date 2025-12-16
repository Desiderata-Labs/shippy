# GitHub App Integration PRD

## Problem Statement

Shippy bounties and GitHub workflows are disconnected. Contributors work in GitHub (issues, PRs, commits) but must manually update Shippy. This creates friction and risks bounty status getting out of sync.

## Goal

Create a GitHub App that bridges Shippy bounties ↔ GitHub activity, enabling:

1. **Auto-linking**: Recognize bounty references (`SHP-123`) in GitHub
2. **Status sync**: Update Shippy when GitHub work is completed
3. **Quick commands**: Slash commands for claiming/creating bounties from GitHub

---

## Core Features (MVP)

### 1. GitHub Connection

- Founders install the Shippy GitHub App on their repo(s)
- Link a GitHub repo to a Shippy project (1:1 for MVP)
- Store: `projectId`, `githubRepoId`, `installationId`

### 2. Bounty Reference Detection

Detect `SHP-123` patterns in:

- Issue titles/bodies
- PR titles/bodies
- Commit messages

Bot comments with bounty details (title, points, status, link).

### 3. Slash Commands

| Command            | Where                       | Action                                                     |
| ------------------ | --------------------------- | ---------------------------------------------------------- |
| `/claim`           | Issue/PR with linked bounty | Claim the bounty for commenter                             |
| `/claim SHP-123`   | Any issue/PR                | Claim specific bounty                                      |
| `/release`         | Issue/PR with linked bounty | Release commenter's claim on the bounty                    |
| `/release SHP-123` | Any issue/PR                | Release claim on specific bounty                           |
| `/bounty 50`       | Issue                       | Create bounty from issue (50 pts)                          |
| `/bounty 50`       | PR                          | Create bounty from PR + auto-link PR as submission + claim |

### 4. PR ↔ Bounty Linking (Linear-style)

**On PR open** referencing `SHP-123`:

- Auto-create claim for PR author (if Shippy account linked)
- Auto-create submission with PR link as proof
- Bounty status → `CLAIMED`
- Bot comments on PR with bounty context

**On `/bounty N` command on a PR**:

- Create bounty from PR title/body
- Auto-create claim for PR author (if Shippy account linked)
- Auto-create submission with PR link as proof
- Bot comments with bounty details

**On PR merge** (any branch):

- If project has **auto-approve on merge** enabled → approve submission, award points
- Works for both text-referenced bounties AND `/bounty` command-linked PRs
- Otherwise → notify founder that PR merged, prompt for approval

### 5. Project Settings (GitHub Connection)

When connecting GitHub to a Shippy project:

- **Auto-approve on merge**: Toggle (default: off) — automatically approve submissions when linked PR merges

---

## Technical Approach

```
┌─────────────┐     Webhook      ┌─────────────┐
│   GitHub    │ ───────────────► │   Shippy    │
│  (App/Bot)  │ ◄─────────────── │   Backend   │
└─────────────┘    API calls     └─────────────┘
```

### Webhook Events to Handle

- `issues.opened` / `issues.edited`
- `pull_request.opened` / `pull_request.merged`
- `issue_comment.created` (for slash commands)
- `push` (for commit message detection)

### New Database Tables

- `GitHubConnection` — project ↔ repo link + installation
- `GitHubLinkage` — bounty ↔ issue/PR mapping

---

## Design Notes

### Branch Agnostic

Unlike CI/CD triggers, bounty completion is tied to **PR merge lifecycle**, not target branch. Whether merging to `main`, `develop`, or a feature branch—merge = work done.

### Reference Syntax

Support common patterns:

- `SHP-123` anywhere in PR title/body
- `fixes SHP-123`, `closes SHP-123` (explicit intent)
- Multiple references: `SHP-123, SHP-124`

### Identifier Scoping

`SHP-123` is **not globally unique** on Shippy—it's unique within a project. Resolution works because:

1. GitHub repo is linked to exactly one Shippy project
2. `SHP-123` in that repo → bounty #123 in the linked project
3. No cross-project references supported (out of scope)

---

## Implementation

### Environment Variables

```env
GITHUB_APP_ID=123456
GITHUB_APP_SLUG=shippy-bot
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_WEBHOOK_SECRET=whsec_xxx
```

### API Routes

| Route                      | Purpose                                         |
| -------------------------- | ----------------------------------------------- |
| `POST /api/github/webhook` | Receive GitHub webhook events                   |
| `GET /api/github/install`  | Redirect to GitHub App install flow             |
| `GET /api/github/callback` | Handle post-install callback, link repo→project |

### Webhook Event Handlers

```
issue_comment.created  → parse slash commands (/claim, /bounty, /release)
pull_request.opened    → detect SHP-xxx, create submission + comment if bounty not found
pull_request.closed    → if merged:
                         - auto-approve ON: approve submission + comment
                         - auto-approve OFF: notify founder via Shippy notification
```

### Database Changes

```prisma
model GitHubConnection {
  id              String   @id @default(nanoid())
  projectId       String   @unique
  project         Project  @relation(fields: [projectId], references: [id])
  installationId  Int      // GitHub App installation ID
  repoId          Int      // GitHub repo ID
  repoFullName    String   // e.g. "shippy-sh/shippy"
  autoApprove     Boolean  @default(false)
  createdAt       DateTime @default(now())
}
```

### Dependencies

```bash
pnpm add @octokit/webhooks @octokit/auth-app @octokit/rest
```

---

## Out of Scope / Unsupported Features

- Multi-repo per project
- Cross-project references (e.g., `OTHER-123` from a different project)
- Bi-directional sync (Shippy → GitHub issues)
- GitHub Actions integration
- Auto-create bounties from labeled issues
- Deployment-triggered completion (vs merge-triggered)

---

## Testing

### 1. Create a GitHub App (Dev)

1. Go to **GitHub → Settings → Developer settings → GitHub Apps → New GitHub App**
2. Configure:
   - **Name**: `shippy-dev-<yourname>` (must be unique on GitHub)
   - **Homepage URL**: `http://localhost:3000`
   - **Callback URL**: `https://<your-ngrok>.ngrok.dev/api/github/callback`
   - **Setup URL**: `https://<your-ngrok>.ngrok.dev/api/github/callback` (same as callback)
   - **Webhook URL**: `https://<your-ngrok>.ngrok.dev/api/github/webhook`
   - **Webhook secret**: Generate one (`openssl rand -hex 20`)
   - **Repository permissions**:
     - `Contents`: Read-only
     - `Issues`: Read and write
     - `Pull requests`: Read and write
     - `Metadata`: Read-only (mandatory, auto-selected)
   - **Subscribe to events** (only these two):
     - ☑️ Issue comment
     - ☑️ Pull request
   - **Where can this GitHub App be installed?**:
     - Dev: "Only on this account"
     - Production: "Any account"
3. After creating, note the **App ID** and generate a **Private Key** (.pem file)

### 2. Expose Local Server (ngrok)

```bash
# Install ngrok if needed
brew install ngrok

# Start tunnel (keep running)
ngrok http 3000
```

Copy your ngrok URL (e.g., `https://iwasrobbed.ngrok.dev`) and use it for the GitHub App URLs above.

### 3. Set Environment Variables

```bash
# .env.local
GITHUB_APP_ID=123456
GITHUB_APP_SLUG=shippy-dev-yourname
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your_webhook_secret
```

For the private key, replace newlines with `\n` or use multiline string.

### 4. Install App on Test Repo

1. Go to `https://github.com/apps/shippy-dev-yourname`
2. Click **Install** → select a test repository
3. This triggers the callback flow, linking the repo to your Shippy project

### 5. Test Scenarios

#### Test A: PR Creates Submission

**Setup:**

1. Create a bounty on Shippy (e.g., `SHP-1`) with 25 points
2. Ensure your GitHub account is linked to your Shippy account

**Steps:**

1. In the connected GitHub repo, create a new branch
2. Make a commit and open a PR with title: `Fix bug SHP-1`
3. Check ngrok terminal for webhook delivery

**Expected:**

- Bot comments on PR: "🚀 Shippy Bounty Linked" with bounty details
- Submission created on Shippy with status `PENDING`
- Bounty status changes to `CLAIMED`

---

#### Test B: PR Merge with Auto-Approve

**Setup:**

1. Complete Test A (have a PR with linked submission)
2. Enable "auto-approve on merge" in project's GitHub connection settings

**Steps:**

1. Merge the PR on GitHub

**Expected:**

- Bot comments: "✅ Submission Approved"
- Submission status → `APPROVED`, points awarded
- Bounty status → `COMPLETED`

---

#### Test C: /claim Command

**Setup:**

1. Create a bounty on Shippy (e.g., `SHP-2`) with status `OPEN`
2. Ensure your GitHub account is linked to Shippy

**Steps:**

1. Open any issue in the connected repo
2. Comment: `/claim SHP-2`

**Expected:**

- Bot replies: "✅ @username has claimed SHP-2: [bounty title]"
- Claim created on Shippy with expiry date
- Bounty status → `CLAIMED`

---

#### Test D: /bounty Command (Founder Only)

**Setup:**

1. Be logged in as the project founder on both GitHub and Shippy

**Steps:**

1. Create a new issue in the connected repo with title "Add dark mode"
2. Comment: `/bounty 50`

**Expected:**

- Bot replies: "🚀 Bounty created: SHP-X (50 pts)"
- New bounty appears on Shippy with title from issue
- Status is `OPEN`, points = 50

---

#### Test E: Unlinked GitHub User

**Setup:**

1. Use a GitHub account that is NOT linked to any Shippy account

**Steps:**

1. Comment `/claim SHP-1` on any issue

**Expected:**

- Bot replies: "@username You need to sign up on Shippy and link your GitHub account..."

---

#### Test F: Invalid Bounty Reference (Slash Command)

**Steps:**

1. Comment `/claim SHP-9999` (non-existent bounty)

**Expected:**

- Bot replies: "Bounty SHP-9999 not found."

---

#### Test G: Invalid Bounty Reference (PR Title/Body)

**Steps:**

1. Open a PR with title "Fixes SHP-9999" (non-existent bounty)

**Expected:**

- Bot comments: "⚠️ Bounty SHP-9999 was not found in this project."

### 6. Debug Tips

- Check ngrok inspector at `http://localhost:4040` for webhook payloads
- Webhook handler logs to console — check terminal for errors
- Verify signature issues by checking `GITHUB_WEBHOOK_SECRET` matches

---

## Edge Cases & Behavior

### Bounty Creation (`/bounty`)

| Scenario                                          | Behavior                                                      |
| ------------------------------------------------- | ------------------------------------------------------------- |
| `/bounty N` on issue with active bounty           | Reply "An active bounty already exists for this issue: SHP-X" |
| `/bounty N` on issue with closed/completed bounty | Creates new bounty (previous one was terminal)                |
| `/bounty N` on PR with active bounty              | Reply "This PR is already linked to an active bounty: SHP-X"  |
| `/bounty N` on PR with closed/completed bounty    | Creates new bounty + submission + claim for PR author         |
| `/bounty N` on PR (author has Shippy account)     | Creates bounty + claim + submission, all auto-linked          |
| `/bounty N` on PR (author NOT on Shippy)          | Creates bounty only, prompts PR author to sign up and claim   |
| Issue/PR title changes after bounty created       | No impact — linked by GitHub issue/PR ID, not title           |
| Non-founder runs `/bounty`                        | Reply "Only the project founder can create bounties"          |

### Claiming (`/claim`)

| Scenario                                    | Behavior                                          |
| ------------------------------------------- | ------------------------------------------------- |
| `/claim` on issue with linked bounty        | Claim that bounty                                 |
| `/claim` on PR with linked submission       | Claim the bounty from the linked submission       |
| `/claim SHP-123` on any issue/PR            | Claim specific bounty                             |
| `/claim` when user already has active claim | Reply "You already have an active claim on SHP-X" |
| `/claim` on closed/completed bounty         | Reply "SHP-X is not open for claims (status: X)"  |
| `/claim SHP-999` (non-existent)             | Reply "Bounty SHP-999 not found"                  |
| Unlinked GitHub user runs `/claim`          | Reply with sign-up instructions                   |

### Releasing (`/release`)

| Scenario                                  | Behavior                                        |
| ----------------------------------------- | ----------------------------------------------- |
| `/release` on issue/PR with linked bounty | Release commenter's claim on that bounty        |
| `/release SHP-123` on any issue/PR        | Release claim on specific bounty                |
| `/release` when user has no claim         | Reply "You don't have an active claim on SHP-X" |
| `/release` sets bounty back to OPEN       | Only if bounty is CLAIMED and no other claims   |
| `/release` on COMPLETED/CLOSED bounty     | Releases claim but does NOT reopen bounty       |
| Claim status after `/release`             | Set to `RELEASED` (not `EXPIRED`)               |

### PR Linking

| Scenario                              | Behavior                                                      |
| ------------------------------------- | ------------------------------------------------------------- |
| PR opened with `SHP-123` reference    | Create claim + submission, link PR, bot comments              |
| PR opened, then `/bounty N` commented | Create bounty + claim + submission, all auto-linked           |
| PR merged with auto-approve ON        | Approve submission, award points, complete bounty             |
| PR merged (linked via `/bounty`)      | Same as above — works for both text refs AND `/bounty` links  |
| PR merged with auto-approve OFF       | Shippy notification sent to founder for manual review         |
| PR closed WITHOUT merge               | No action (submission stays pending)                          |
| Multiple PRs reference same bounty    | Each creates a submission (competitive mode)                  |
| PR references non-existent bounty     | Bot comments "Bounty SHP-X not found"                         |
| PR author not linked to Shippy        | Bot comments with sign-up instructions, no submission created |
| PR author already has claim on bounty | Reuses existing claim, creates submission                     |

### Data Integrity

| Scenario                       | Behavior                                          |
| ------------------------------ | ------------------------------------------------- |
| Bounty deleted after PR linked | Submission orphaned (cascade delete handles this) |
| GitHub repo disconnected       | Existing links remain, no new webhooks processed  |
| GitHub issue deleted           | Link remains in DB (no webhook for deletion)      |

---

## Decisions

- **No label inheritance** — `/bounty` creates bounties with default settings, not GitHub issue labels
- **GitHub account linking required** — contributors must sign up on Shippy and link their GitHub account before claiming via GitHub commands
