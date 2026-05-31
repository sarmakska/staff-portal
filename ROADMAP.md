# Roadmap

What is in, what is next, and what is parked. The living version is in the [project wiki](https://github.com/sarmakska/staff-portal/wiki/Roadmap).

## Shipped

- Attendance, timesheets, leave, expenses, purchase requests
- Visitor management and reception desk
- Mobile-friendly public kiosk with per-user PIN sign-in
- Five-role RBAC enforced via Row Level Security
- Single sign-on via Microsoft Entra ID, Google Workspace, GitHub, GitLab, and SAML 2.0
- Leave-balance accruals with a monthly cron, an annual cap, and idempotent runs
- Year-end leave rollover with per-employee carry-forward caps
- GDPR data-portability export, self-service and admin-driven
- Immutable audit log covering logins, SSO logins, leave events, accruals, and exports
- Cron jobs for reminders, cleanups, leave accrual, and year-end rollover
- Jarvis AI assistant (optional Groq integration)
- PDF generation and Excel export
- Bank-statement reconciliation, wellness module, IT support tickets
- Logic test suites for SSO, accruals, and GDPR export with fixtures

## Next

- Mobile app wrapper for offline clock-in
- Slack and Teams notifications alongside email
- Multi-step expense approval chains
- Two-way calendar sync for leave
- SCIM provisioning to complement SSO
- Browser-driven UI tests on top of the logic suite

## Parked

- Native time-tracking integrations (Toggl, Harvest)
- Multi-tenant SaaS mode (the project is self-host first)
- Country-specific payroll export
