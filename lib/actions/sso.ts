'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { authRoute, isOAuthProvider, type SsoConnection, type SsoProvider } from '@/lib/sso'

// ── Read the active SSO connections (public) ─────────────────

export async function getSsoConnections(): Promise<SsoConnection[]> {
    const { data } = await supabaseAdmin
        .from('sso_connections' as never)
        .select('domain, provider, display_name, is_active')
        .eq('is_active' as never, true as never)

    return ((data ?? []) as { domain: string; provider: string; display_name: string; is_active: boolean }[])
        .map(r => ({
            domain: r.domain,
            provider: r.provider as SsoProvider,
            displayName: r.display_name,
            isActive: r.is_active,
        }))
}

// ── Begin SSO sign-in for an email ───────────────────────────
// Returns a redirect URL the client should send the browser to, or
// kind 'password' when the domain has no SSO connection.

export async function beginSso(email: string): Promise<{
    kind: 'oauth' | 'saml' | 'password'
    url?: string
    provider?: string
    error?: string
}> {
    const connections = await getSsoConnections()
    const route = authRoute(email, connections)

    if (route.kind === 'password' || !route.connection) {
        return { kind: 'password' }
    }

    const supabase = await createClient()
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const redirectTo = `${origin}/auth/callback`

    if (route.kind === 'saml') {
        const { data, error } = await supabase.auth.signInWithSSO({
            domain: route.connection.domain,
            options: { redirectTo },
        })
        if (error || !data?.url) {
            return { kind: 'saml', error: error?.message ?? 'Could not start SSO.' }
        }
        return { kind: 'saml', url: data.url, provider: route.connection.provider }
    }

    if (!isOAuthProvider(route.connection.provider)) {
        return { kind: 'oauth', error: 'Unsupported SSO provider.' }
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: route.connection.provider as never,
        options: { redirectTo, skipBrowserRedirect: true },
    })
    if (error || !data?.url) {
        return { kind: 'oauth', error: error?.message ?? 'Could not start SSO.' }
    }
    return { kind: 'oauth', url: data.url, provider: route.connection.provider }
}

// ── Admin management ─────────────────────────────────────────

async function requireAdmin(): Promise<{ ok: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated' }
    const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
    const roles = (data ?? []).map((r: { role: string }) => r.role)
    if (!roles.includes('admin')) return { ok: false, error: 'Admin access required' }
    return { ok: true }
}

export async function listSsoConnections(): Promise<{ connections: SsoConnection[]; error?: string }> {
    const auth = await requireAdmin()
    if (!auth.ok) return { connections: [], error: auth.error }

    const { data } = await supabaseAdmin
        .from('sso_connections' as never)
        .select('domain, provider, display_name, is_active')
        .order('domain' as never)

    const connections = ((data ?? []) as { domain: string; provider: string; display_name: string; is_active: boolean }[])
        .map(r => ({ domain: r.domain, provider: r.provider as SsoProvider, displayName: r.display_name, isActive: r.is_active }))
    return { connections }
}

export async function upsertSsoConnection(params: {
    domain: string
    provider: SsoProvider
    displayName: string
    isActive: boolean
}): Promise<{ success: boolean; error?: string }> {
    const auth = await requireAdmin()
    if (!auth.ok) return { success: false, error: auth.error }

    const domain = params.domain.trim().toLowerCase()
    if (!domain.includes('.')) return { success: false, error: 'Enter a valid email domain (e.g. acme.com).' }

    const { error } = await supabaseAdmin
        .from('sso_connections' as never)
        .upsert(
            {
                domain,
                provider: params.provider,
                display_name: params.displayName.trim() || domain,
                is_active: params.isActive,
            } as never,
            { onConflict: 'domain' },
        )

    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/sso')
    return { success: true }
}

export async function deleteSsoConnection(domain: string): Promise<{ success: boolean; error?: string }> {
    const auth = await requireAdmin()
    if (!auth.ok) return { success: false, error: auth.error }

    const { error } = await supabaseAdmin
        .from('sso_connections' as never)
        .delete()
        .eq('domain' as never, domain.trim().toLowerCase() as never)

    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/sso')
    return { success: true }
}
