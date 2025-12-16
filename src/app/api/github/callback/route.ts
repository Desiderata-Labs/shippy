import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/server'
import { prisma } from '@/lib/db/server'
import { getAppOctokit, getInstallationOctokit } from '@/lib/github/server'
import { routes } from '@/lib/routes'

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    'http://localhost:3050'
  )
}

/**
 * Callback handler after GitHub App installation
 * GitHub redirects here with installation_id and setup_action
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session) {
    return NextResponse.redirect(new URL('/sign-in', getBaseUrl()))
  }

  const installationId = request.nextUrl.searchParams.get('installation_id')
  const state = request.nextUrl.searchParams.get('state')

  if (!installationId || !state) {
    return NextResponse.json(
      { error: 'Missing installation_id or state' },
      { status: 400 },
    )
  }

  // Decode state to get projectId
  let stateData: { projectId: string; userId: string }
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64url').toString())
  } catch {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
  }

  // Verify the user matches
  if (stateData.userId !== session.user.id) {
    return NextResponse.json({ error: 'User mismatch' }, { status: 403 })
  }

  // Verify the project belongs to this user
  const project = await prisma.project.findFirst({
    where: {
      id: stateData.projectId,
      founderId: session.user.id,
    },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Get installation details from GitHub (app-level auth)
  const appOctokit = getAppOctokit()
  // Verify the installation exists (will throw if not)
  await appOctokit.apps.getInstallation({
    installation_id: parseInt(installationId, 10),
  })

  // Get the repositories for this installation (installation-level auth required)
  const installationOctokit = await getInstallationOctokit(
    parseInt(installationId, 10),
  )
  const { data: repos } =
    await installationOctokit.apps.listReposAccessibleToInstallation({
      per_page: 100,
    })

  if (repos.repositories.length === 0) {
    return NextResponse.json(
      { error: 'No repositories found for this installation' },
      { status: 400 },
    )
  }

  // If only one repo, link it directly
  if (repos.repositories.length === 1) {
    const repo = repos.repositories[0]
    await prisma.gitHubConnection.upsert({
      where: { projectId: project.id },
      create: {
        projectId: project.id,
        installationId: parseInt(installationId, 10),
        repoId: repo.id,
        repoFullName: repo.full_name,
      },
      update: {
        installationId: parseInt(installationId, 10),
        repoId: repo.id,
        repoFullName: repo.full_name,
      },
    })
    return NextResponse.redirect(
      new URL(
        routes.project.integrations({ slug: project.slug }),
        getBaseUrl(),
      ),
    )
  }

  // Multiple repos - redirect to picker page
  const pickerUrl = new URL(
    routes.project.integrations({ slug: project.slug }),
    getBaseUrl(),
  )
  pickerUrl.searchParams.set('installation_id', installationId)
  pickerUrl.searchParams.set('pick_repo', 'true')
  return NextResponse.redirect(pickerUrl)
}
