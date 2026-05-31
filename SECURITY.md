# Security Policy

## Supported versions

StaffPortal is distributed from the `main` branch and security fixes are applied there. Run the latest commit on `main` to receive patches. There are no separately maintained long-term support branches at this time.

## Reporting a vulnerability

If you discover a security vulnerability, please report it privately rather than opening a public issue. Email sarma@sarmalinux.com with a description of the issue, the affected component or endpoint, and steps to reproduce. Where relevant, include the deployment context (self-hosted, Vercel, Supabase configuration) so the report can be assessed accurately. You will receive an acknowledgement within 72 hours and a remediation plan or status update within seven days. Coordinated disclosure is preferred: please allow a reasonable window for a fix to ship before any public write-up, and credit will be given to reporters who request it.

## Scope and hardening notes

StaffPortal relies on Supabase Row Level Security for data isolation, server-side service-role keys that must never be exposed to the client, and a `CRON_SECRET` bearer token to authenticate scheduled jobs. When self-hosting, keep `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` out of client bundles and version control, restrict Supabase Auth redirect URLs to known origins, and rotate API keys if a leak is suspected. Reports covering misconfiguration of these controls in the default setup are in scope.
