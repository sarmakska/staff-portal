// ============================================================
// Single sign-on (SSO) — provider resolution helpers.
// Pure functions are kept here so the login flow can decide
// which identity provider to route an email to without any
// database or network access in the hot path of a unit test.
//
// SSO is layered on top of Supabase Auth. OAuth providers
// (azure, google, github...) use signInWithOAuth; SAML 2.0
// uses signInWithSSO. This module decides which path applies
// for a given email address.
// ============================================================

export type SsoProvider =
    | 'azure'
    | 'google'
    | 'github'
    | 'gitlab'
    | 'saml'

export interface SsoConnection {
    domain: string
    provider: SsoProvider
    displayName: string
    isActive: boolean
}

// Supabase OAuth providers we support routing to. SAML is handled
// separately via signInWithSSO and is not in this set.
const OAUTH_PROVIDERS = new Set<SsoProvider>(['azure', 'google', 'github', 'gitlab'])

export function isOAuthProvider(provider: string): provider is SsoProvider {
    return OAUTH_PROVIDERS.has(provider as SsoProvider)
}

// Extract the lower-cased domain from an email address.
// Returns null when the value is not a plausible email.
export function domainFromEmail(email: string): string | null {
    const trimmed = (email ?? '').trim().toLowerCase()
    const at = trimmed.lastIndexOf('@')
    if (at <= 0 || at === trimmed.length - 1) return null
    const domain = trimmed.slice(at + 1)
    if (!domain.includes('.')) return null
    return domain
}

// Given an email and the set of active SSO connections, decide how
// the user should authenticate. Returns the matching connection or
// null when the domain has no SSO connection (password sign-in).
export function resolveSso(
    email: string,
    connections: SsoConnection[],
): SsoConnection | null {
    const domain = domainFromEmail(email)
    if (!domain) return null
    const match = connections.find(c => c.isActive && c.domain.toLowerCase() === domain)
    return match ?? null
}

// Describe the authentication route for an email: 'oauth', 'saml',
// or 'password'. Used by the login screen to pick the right button.
export function authRoute(
    email: string,
    connections: SsoConnection[],
): { kind: 'oauth' | 'saml' | 'password'; connection: SsoConnection | null } {
    const connection = resolveSso(email, connections)
    if (!connection) return { kind: 'password', connection: null }
    if (connection.provider === 'saml') return { kind: 'saml', connection }
    return { kind: 'oauth', connection }
}
