// ============================================================
// Auth Callback Route
// Handles both:
//  1. PKCE code exchange (same browser, standard flow)
//  2. token_hash + type (email link opened in different browser)
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit'
import { type NextRequest } from 'next/server'

// Ensure a profile and standard leave balances exist for a user that
// arrived via SSO (no signUp server action runs in that path), then
// record the SSO login in the audit trail.
async function bootstrapSsoUser(userId: string, email: string | undefined) {
    const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle()

    if (!profile && email) {
        const fName = email.split('@')[0].split('.')
            .map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
        await supabaseAdmin.from('user_profiles').insert({
            id: userId, email, full_name: fName, display_name: fName, is_active: true,
        })
    }

    const currentYear = new Date().getFullYear()
    const { data: balances } = await supabaseAdmin
        .from('leave_balances')
        .select('leave_type')
        .eq('user_id', userId)
        .eq('year', currentYear)

    if (!balances || balances.length === 0) {
        await supabaseAdmin.from('leave_balances').insert([
            { user_id: userId, leave_type: 'annual' as never, total: 25, year: currentYear },
            { user_id: userId, leave_type: 'sick' as never, total: 10, year: currentYear },
            { user_id: userId, leave_type: 'unpaid' as never, total: 365, year: currentYear },
        ])
    }

    await writeAuditLog({
        actorId: userId,
        actorEmail: email,
        action: 'sso_login',
        entityTable: 'auth.users',
        entityId: userId,
    })
}

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url)

    const code = searchParams.get('code')
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type') as 'email' | 'recovery' | 'magiclink' | null
    const next = searchParams.get('next') ?? '/'
    const error = searchParams.get('error')
    const errorDesc = searchParams.get('error_description')

    const forwardedHost = request.headers.get('x-forwarded-host')
    const isLocal = process.env.NODE_ENV === 'development'

    const redirectTo = (path: string) => {
        const base = isLocal ? origin : forwardedHost ? `https://${forwardedHost}` : origin
        return NextResponse.redirect(`${base}${path}`)
    }

    // Handle errors passed back from Supabase (e.g. expired link)
    if (error) {
        return redirectTo(`/verify-email?error=${encodeURIComponent(errorDesc ?? error)}`)
    }

    const supabase = await createClient()

    // ── Path 1: token_hash (works even when link opened in a different browser) ──
    if (token_hash && type) {
        const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash, type })

        if (verifyError) {
            return redirectTo(`/verify-email?error=${encodeURIComponent(verifyError.message)}`)
        }

        // Mark email verified in profile
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            await supabase
                .from('user_profiles')
                .update({ is_email_verified: true })
                .eq('id', user.id)
        }

        return redirectTo(next)
    }

    // ── Path 2: PKCE code exchange (same browser flow) ────────────────────────
    if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (exchangeError) {
            // PKCE mismatch — tell user to click the link from the same browser
            if (exchangeError.message.includes('code verifier')) {
                return redirectTo(
                    '/verify-email?error=' +
                    encodeURIComponent('Verification link expired or opened in a different browser. Please request a new link below.')
                )
            }
            return redirectTo(`/verify-email?error=${encodeURIComponent(exchangeError.message)}`)
        }

        // Mark email verified in profile
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            await supabase
                .from('user_profiles')
                .update({ is_email_verified: true })
                .eq('id', user.id)

            // SSO logins (OAuth / SAML) come back through this code
            // exchange with a non-email identity provider. Bootstrap
            // the profile and balances and record the login.
            const provider = user.app_metadata?.provider
            if (provider && provider !== 'email') {
                await bootstrapSsoUser(user.id, user.email)
            }
        }

        return redirectTo(next)
    }

    // No code or token — redirect to login
    return redirectTo('/login')
}
