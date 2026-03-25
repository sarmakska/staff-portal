"use server"

import { supabaseAdmin } from "@/lib/supabase/admin"

export interface SupabaseMetrics {
    dbSizeBytes: number
    storageSizeBytes: number
    activeUsers: number
}

export interface VercelDeployment {
    uid: string
    state: string
    createdAt: number
    meta?: { githubCommitMessage?: string; githubCommitRef?: string; githubCommitSha?: string }
    url?: string
}

export interface VercelMetrics {
    lastDeployment: VercelDeployment | null
    deploymentsThisMonth: number
    error?: string
}

export interface GitHubWorkflowRun {
    id: number
    name: string
    conclusion: string | null
    status: string
    created_at: string
    updated_at: string
}

export interface GitHubWorkflowSummary {
    name: string
    lastRun: GitHubWorkflowRun | null
}

export interface GitHubMetrics {
    totalRunsThisMonth: number
    approxMinutesUsed: number
    workflows: GitHubWorkflowSummary[]
    error?: string
}

export interface SystemStatus {
    supabase: SupabaseMetrics | null
    vercel: VercelMetrics | null
    github: GitHubMetrics | null
    fetchedAt: string
}

// Workflow IDs for sarmakska/staff-portal
const GITHUB_REPO = 'sarmakska/staff-portal'
const WORKFLOWS = [
    { id: 246268678, name: 'Birthday Reminder' },
    { id: 246262246, name: 'Diary Reminders' },
    { id: 240960655, name: 'Vercel Deployment' },
]

export async function getSystemStatus(): Promise<SystemStatus> {
    const fetchedAt = new Date().toISOString()
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // --- Supabase metrics ---
    let supabase: SupabaseMetrics | null = null
    try {
        const [dbSizeResult, storageSizeResult, usersResult] = await Promise.all([
            (supabaseAdmin.rpc as any)('get_db_size_bytes'),
            (supabaseAdmin.rpc as any)('get_storage_size_bytes'),
            supabaseAdmin.from('user_profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
        ])
        supabase = {
            dbSizeBytes: (dbSizeResult.data as number) ?? 0,
            storageSizeBytes: (storageSizeResult.data as number) ?? 0,
            activeUsers: usersResult.count ?? 0,
        }
    } catch (err) {
        console.error('[system-status] Supabase metrics error:', err)
    }

    // --- Vercel metrics ---
    let vercel: VercelMetrics | null = null
    const vercelToken = process.env.VERCEL_API_TOKEN
    if (vercelToken) {
        try {
            const res = await fetch('https://api.vercel.com/v6/deployments?app=staff-portal&limit=30', {
                headers: { Authorization: `Bearer ${vercelToken}` },
                next: { revalidate: 300 },
            })
            if (res.ok) {
                const data = await res.json()
                const deployments: VercelDeployment[] = data.deployments ?? []
                vercel = {
                    lastDeployment: deployments[0] ?? null,
                    deploymentsThisMonth: deployments.filter(d => d.createdAt >= monthStart.getTime()).length,
                }
            } else {
                vercel = { lastDeployment: null, deploymentsThisMonth: 0, error: `API ${res.status}` }
            }
        } catch {
            vercel = { lastDeployment: null, deploymentsThisMonth: 0, error: 'Fetch failed' }
        }
    } else {
        vercel = { lastDeployment: null, deploymentsThisMonth: 0, error: 'VERCEL_API_TOKEN not set' }
    }

    // --- GitHub Actions metrics ---
    let github: GitHubMetrics | null = null
    const githubToken = process.env.GITHUB_TOKEN
    if (githubToken) {
        try {
            const ghHeaders = {
                Authorization: `Bearer ${githubToken}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
            }
            const monthStr = monthStart.toISOString().slice(0, 10)

            // Fetch runs this month (pages 1+2) + last run of each workflow — all in parallel
            const [page1Res, page2Res, ...wfRunResults] = await Promise.all([
                fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/runs?per_page=100&created=>=${monthStr}`, { headers: ghHeaders, next: { revalidate: 3600 } }),
                fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/runs?per_page=100&page=2&created=>=${monthStr}`, { headers: ghHeaders, next: { revalidate: 3600 } }),
                ...WORKFLOWS.map(w =>
                    fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${w.id}/runs?per_page=1`, { headers: ghHeaders, next: { revalidate: 3600 } })
                ),
            ])

            const [page1, page2, ...wfRunData] = await Promise.all([
                page1Res.json(),
                page2Res.json(),
                ...wfRunResults.map(r => r.json()),
            ])

            const allRuns: GitHubWorkflowRun[] = [
                ...(page1.workflow_runs ?? []),
                ...(page2.workflow_runs ?? []),
            ]

            // Approx minutes = sum of (updated_at - created_at) for completed runs, in minutes
            const approxMinutesUsed = Math.round(
                allRuns.reduce((sum, r) => {
                    if (!r.updated_at || !r.created_at) return sum
                    const ms = new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()
                    return sum + Math.max(0, ms / 60000)
                }, 0)
            )

            github = {
                totalRunsThisMonth: page1.total_count ?? allRuns.length,
                approxMinutesUsed,
                workflows: WORKFLOWS.map((w, i) => ({
                    name: w.name,
                    lastRun: (wfRunData[i]?.workflow_runs?.[0] as GitHubWorkflowRun) ?? null,
                })),
            }
        } catch (err) {
            console.error('[system-status] GitHub metrics error:', err)
            github = { totalRunsThisMonth: 0, approxMinutesUsed: 0, workflows: [], error: 'Fetch failed' }
        }
    }

    return { supabase, vercel, github, fetchedAt }
}
