// Shared test fixtures modelling a small organisation. These mirror
// the shape of the rows the application reads from Supabase so the
// pure logic can be exercised end-to-end without a live database.

export const ssoConnections = [
    { domain: 'acme.com', provider: 'azure', displayName: 'Acme Corp', isActive: true },
    { domain: 'globex.com', provider: 'saml', displayName: 'Globex', isActive: true },
    { domain: 'initech.com', provider: 'google', displayName: 'Initech', isActive: false },
]

export const annualBalance = {
    id: 'bal-1',
    user_id: 'user-1',
    leave_type: 'annual',
    total: 24,
    accrual_rate: 2,
    accrued_to_date: 0,
    last_accrued_on: null,
}

export const gdprSources = [
    {
        table: 'user_profiles',
        description: 'Profile, contact details and work settings.',
        records: [{ id: 'user-1', email: 'ada@acme.com', full_name: 'Ada Lovelace' }],
    },
    {
        table: 'attendance',
        description: 'Clock in and clock out records.',
        records: [
            { id: 'att-1', user_id: 'user-1', work_date: '2026-05-01' },
            { id: 'att-2', user_id: 'user-1', work_date: '2026-05-02' },
        ],
    },
    {
        table: 'leave_requests',
        description: 'Leave requests and their status.',
        records: [],
    },
]
