# StaffPortal

> A complete, open-source staff management platform built with Next.js and Supabase.

[![MIT License](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com)

StaffPortal is a fully-featured, open-source internal staff management system. Attendance, timesheets, leave management, expenses with AI receipt scanning, a kiosk sign-in system, team calendar, visitor management, announcements and more — all in one platform.

Built by [Sarma Linux](https://sarmalinux.com) · Open Source · MIT Licensed

---

## Screenshots

> Add your own screenshots here after deployment.

---

## Features

### For All Staff
- **Dashboard** — Personalised overview: weather widget, leave balances, diary reminders, week hours summary, quick actions
- **Attendance** — Clock in/out, work from home toggle, running late logging, early departure with reason
- **Timesheets** — Weekly hours view with date range presets and Excel export
- **Leave** — Apply for annual, sick, unpaid, maternity, or paternity leave with multi-step approval and PDF certificates
- **Expenses** — AI receipt scanning auto-fills merchant, amount, VAT, and card details; approval flow with PDF claim forms emailed to accounts
- **Diary** — Personal work notes with date-based email reminders
- **Calendar** — Team-wide calendar showing leave, WFH, events, and public holidays
- **Directory** — Staff contact cards with phone, email, and WhatsApp actions
- **Announcements** — Rich text company-wide announcements with email notifications
- **Feedback and Complaints** — Private staff submission system

### For Reception and Admin
- **Visitors** — Pre-register visitors, QR code references, host email notifications on check-in
- **Reception Desk** — Quick check-in and check-out for today's visitors
- **Roll Call** — Live view of who is currently clocked in
- **Kiosk Settings** — Toggle which staff appear on the kiosk, manage PINs per person

### For Directors and Accounts
- **Analytics** — Monthly charts: late arrivals, under-hours, visitor traffic, leave summary with CSV export
- **All Staff Timesheets** — Read-only access to every employee timesheet
- **Staff Summary** — Overview of all staff: hours, department, role, status

### For Admin
- **User Management** — Create accounts, assign roles, activate or deactivate staff
- **Leave Allowances** — Set balances per employee, configure carry-forward caps
- **Leave Records** — Full leave history, resend approval emails
- **Timesheet Editor** — Edit any staff member's clock in/out times
- **Corrections Management** — Review and approve timesheet correction requests
- **Forgotten Clock-Outs** — Auto-detection of staff who forgot to clock out
- **Audit Log** — Full system audit trail
- **Notification Settings** — Toggle each email notification on or off
- **Organisation** — Manage departments

### Kiosk Mode (`/kiosk`)
- Runs at `/kiosk` with no login required — designed for a shared office tablet
- Staff clock in/out with their personal 4-digit PIN
- Walk-in visitor registration with QR code reference
- Visitor checkout

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5.7 |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui + Radix UI |
| Email | Resend |
| AI Receipt OCR | Anthropic Claude / Google Gemini |
| Charts | Recharts |
| Excel Export | ExcelJS |
| PDF Generation | PDFKit |
| Hosting | Vercel (recommended) |
| Cron Jobs | Vercel Cron |

---

## Roles

| Role | Access |
|------|--------|
| `employee` | Own attendance, timesheets, leave, expenses, diary, calendar, announcements |
| `reception` | Employee + visitors, reception desk, roll call, kiosk settings |
| `director` | Employee + analytics, all timesheets (read only), staff summary |
| `accounts` | Employee + all timesheets (read only), expense reports |
| `admin` | Full access to everything |

---

## Setup Guide

### Prerequisites

- [Node.js 18+](https://nodejs.org)
- [Git](https://git-scm.com)
- [Supabase account](https://supabase.com) — free tier works
- [Resend account](https://resend.com) — free tier works

---

### Step 1 — Clone the Repository

```bash
git clone https://github.com/sarmakska/staff-portal.git
cd staff-portal
npm install
```

---

### Step 2 — Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**, give it a name, set a strong database password
3. Wait ~1 minute for the project to be ready
4. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon/public** key
   - **service_role** key _(keep this secret — server only)_

---

### Step 3 — Run the Database Migrations

1. In Supabase, go to **SQL Editor**
2. Open each file in `supabase/migrations/` in numbered order
3. Paste the contents of each file and click **Run**
4. Run them in order: 001, 002, 003 ... through all files

---

### Step 4 — Set Up Email with Resend

1. Go to [resend.com](https://resend.com) and create an account
2. Go to **Domains** → add and verify your sending domain
3. Go to **API Keys** → create a new key and copy it

---

### Step 5 — Configure Environment Variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Email
RESEND_API_KEY=re_your_api_key
RESEND_FROM_EMAIL=noreply@yourcompany.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Notification destinations
WFH_NOTIFY_EMAIL=admin@yourcompany.com
ACCOUNTS_NOTIFY_EMAIL=accounts@yourcompany.com

# Restrict signups to this domain (leave empty for any email)
NEXT_AUTH_DOMAIN=@yourcompany.com

# Your admin email — gets admin role automatically on first login
NEXT_PUBLIC_ADMIN_EMAIL=you@yourcompany.com

# Cron auth secret
CRON_SECRET=any-random-string

# AI receipt OCR (optional — get from console.anthropic.com)
ANTHROPIC_API_KEY=your-anthropic-key
```

---

### Step 6 — Configure Supabase Auth

1. In Supabase go to **Authentication → Email → Templates → Confirm sign up**
2. Make sure the confirmation link uses `{{ .SiteURL }}`:
   ```html
   <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
   ```
3. Go to **Authentication → URL Configuration**
4. Set **Site URL** to `http://localhost:3000`
5. Add `http://localhost:3000/auth/callback` to **Redirect URLs**

---

### Step 7 — Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

### Step 8 — Create Your Admin Account

1. Go to `/signup` and sign up with your `NEXT_PUBLIC_ADMIN_EMAIL` address
2. Verify your email via the confirmation link
3. Log in — you will automatically have the `admin` role

---

## Deploying to Production (Vercel)

1. Push your code to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import your repo
3. Under **Environment Variables**, add all values from your `.env.local`
4. Change `NEXT_PUBLIC_APP_URL` to your production URL
5. Click **Deploy**

After deploying, update Supabase:
- **Site URL** → your Vercel URL
- **Redirect URLs** → add your Vercel URL `/auth/callback`

Cron jobs are already configured in `vercel.json`. Make sure `CRON_SECRET` is set in Vercel environment variables.

---

## How It Works

**Authentication** — Email/password via Supabase Auth. Restrict signups to a company domain via `NEXT_AUTH_DOMAIN`. Admin role assigned automatically on first login.

**Attendance** — Staff clock in/out from the dashboard or kiosk. Admins can edit records and approve correction requests.

**Leave** — Staff submit requests and choose approvers. Approvers get email notifications. On approval, staff receive a PDF certificate. Year-end carry-forward runs automatically on Jan 1st via cron.

**Expenses** — Staff upload receipts and AI extracts all data. On approval of a personal claim, a PDF claim form is emailed to the staff member and the accounts team. Refunds tracked as negative credits throughout.

**Kiosk** — Runs at `/kiosk` with no login required. Staff enter their PIN to clock in/out. Visitors self-register and receive a QR code.

**Email** — All emails sent via Resend. Toggle each notification type on/off in Admin → Notifications.

---

## Project Structure

```
staff-portal/
├── app/
│   ├── (app)/          # All authenticated pages
│   ├── (auth)/         # Login, signup, password reset
│   ├── api/            # API routes and cron handlers
│   └── kiosk/          # Public kiosk (no auth required)
├── components/
│   ├── layout/         # Sidebar, topbar, footer
│   └── ui/             # Shared UI components
├── lib/
│   ├── actions/        # Server actions (all DB operations)
│   ├── email/          # Email templates and sending
│   └── supabase/       # Supabase client setup
├── supabase/
│   └── migrations/     # Database SQL migrations in order
└── types/              # TypeScript type definitions
```

---

## Contributing

Contributions are welcome!

1. Fork the repository
2. Create a branch: `git checkout -b feature/your-feature`
3. Make your changes and test with `npm run dev`
4. Commit: `git commit -m "feat: your feature description"`
5. Push and open a Pull Request

**Ideas for contributions:**
- Mobile app (React Native / Expo)
- Slack / Teams integration
- Payroll export (Xero, QuickBooks)
- Mileage and travel expense tracking
- Shift scheduling and rota management
- Custom leave types
- Multi-language (i18n) support
- Accessibility improvements (WCAG 2.1)
- End-to-end tests with Playwright

---

## License

[MIT License](LICENSE) — free to use, modify, and distribute for any purpose including commercial use.

---

## Support

- Bug reports and feature requests: [GitHub Issues](https://github.com/sarmakska/staff-portal/issues)
- Built by [Sarma Linux](https://sarmalinux.com)

---

*StaffPortal — Open Source Staff Management · [sarmalinux.com](https://sarmalinux.com)*
