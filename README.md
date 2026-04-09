# StaffPortal

> Open-source staff management platform — built with Next.js 14, Supabase, and Tailwind CSS.

[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38BDF8?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Open Source](https://img.shields.io/badge/Open%20Source-%E2%9D%A4-red)](https://github.com/your-github-username/staff-portal)

A full-featured HR and workforce management platform you can self-host for your team. Built for small-to-medium businesses that want a modern, clean alternative to expensive HR software.

---

## Features

### For All Staff

- **Dashboard** — Personalised overview: leave balances, week hours summary, diary reminders, quick actions
- **Attendance** — Clock in/out, work from home toggle, running late logging, late arrival detection
- **WFH Logging** — Log full day, morning, or afternoon as work from home
- **Attendance Corrections** — Submit correction requests with approval workflow
- **Timesheets** — Weekly hours view with contracted hours tracking and Excel export
- **Leave** — Apply for annual, sick, maternity/paternity, or unpaid leave; multi-step approval with PDF certificates
- **Leave Withdrawal** — Withdraw approved leave; full record kept, balance reversed, email sent
- **Expenses** — Expense claims with category, merchant, amount, receipt upload; PDF claim forms
- **Purchase Requests** — Submit purchase requests for admin approval
- **Diary** — Personal work notes with date-based email reminders
- **Calendar** — Team-wide calendar showing leave, WFH, events, and office presence
- **Staff Directory** — Contact cards with phone, email, and profile details
- **Announcements** — Company-wide announcements with email broadcast
- **Polls** — Company polls with real-time vote counts
- **AI Assistant (Jarvis)** — Conversational AI assistant with awareness of your attendance, leave, expenses, and team

### For Reception and Admin

- **Visitors** — Pre-register visitors, QR code references, host email notifications on check-in
- **Reception Desk** — Quick check-in and check-out for today's visitors
- **Visitor PDF Passes** — Generate and print visitor passes
- **Kiosk Mode** — Self-service clock in/out and visitor check-in at `/kiosk` (no login required)

### Wellness

- Wellness check-ins and mood tracking
- Breathing exercises and stretch reminders
- Admin wellness dashboard

### IT Support

- IT ticket submission
- Admin ticket management and status tracking
- Auto-cleanup of resolved tickets via cron

### Admin

- **User Management** — Create, activate/deactivate accounts, assign roles
- **Department Management** — Create and manage departments
- **Work Schedule Management** — Set per-user contracted hours and working days
- **Leave Records** — Full leave history with filters; resend approval emails
- **Leave Allowances** — Set balances per employee, configure carry-forward caps
- **Corrections Management** — Review and approve timesheet correction requests
- **Forgotten Clock-Outs** — Auto-detect staff who forgot to clock out
- **Email Notification Settings** — Toggle each notification type on/off individually
- **Analytics** — Late arrivals, WFH trends, office attendance, hours vs contracted; CSV export
- **Bank Statement Reconciliation** — Export and reconcile expense data
- **Audit Log** — Full system audit trail

---

## AI Assistant (Jarvis)

The built-in AI assistant is powered by [Groq](https://console.groq.com) and has real-time access to:

- Your attendance records — clock in/out times, late arrivals
- Your leave balances and upcoming approved leave
- Your contracted hours vs actual hours this week (overtime calculator)
- Team leave — who is off this week and next week
- Who is currently in the office (WFH vs office)
- Upcoming team birthdays
- Your recent expenses and purchase requests
- Active polls and announcements
- Issue reporting — collects details and emails the admin team
- Wellness support mode

The assistant's personality and system prompt are fully customisable in `app/api/chat/route.ts`. You can swap Groq for any OpenAI-compatible API.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database & Auth | Supabase (PostgreSQL + Row Level Security) |
| Styling | Tailwind CSS + shadcn/ui |
| Email | Resend |
| AI | Groq API (llama-3.3-70b-versatile) — optional |
| PDF | PDFKit |
| Charts | Recharts |
| Excel Export | ExcelJS |
| Deployment | Vercel (recommended) |

---

## Roles

| Role | Access Level |
|------|-------------|
| `employee` | Own attendance, timesheets, leave, expenses, diary, calendar, announcements |
| `reception` | Employee + visitors, reception desk, kiosk settings |
| `director` | Employee + analytics, all timesheets (read-only), staff summary |
| `accounts` | Employee + all timesheets (read-only), expense reports |
| `admin` | Full access to everything |

---

## Getting Started

### Prerequisites

- [Node.js 18+](https://nodejs.org)
- [Supabase account](https://supabase.com) — free tier works
- [Resend account](https://resend.com) — free tier works
- [Groq API key](https://console.groq.com) — optional, only needed for the AI assistant

### 1. Clone the repo

```bash
git clone https://github.com/your-github-username/staff-portal.git
cd staff-portal
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**, set a name and strong database password
3. Wait ~1 minute for the project to be ready
4. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon/public** key
   - **service_role** key _(keep this secret — server-side only)_

### 3. Run the database migrations

1. In Supabase, go to **SQL Editor**
2. Open each file in `supabase/migrations/` in numbered order
3. Paste and run them one by one: `001_...`, `002_...`, through all files

Or use the Supabase CLI:

```bash
supabase db push
```

### 4. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local` with your values. See the [Environment Variables](#environment-variables) section below.

### 5. Configure Supabase Auth

1. In Supabase go to **Authentication → URL Configuration**
2. Set **Site URL** to `http://localhost:3000`
3. Add `http://localhost:3000/auth/callback` to **Redirect URLs**

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 7. Create your admin account

1. Go to `/signup` and sign up with your admin email address
2. Verify your email via the confirmation link
3. Log in — update your role to `admin` directly in the Supabase table editor

### 8. Deploy to Vercel

```bash
npx vercel
```

Add all environment variables in the Vercel dashboard under **Project Settings → Environment Variables**. Update `NEXT_PUBLIC_APP_URL` to your production URL.

After deploying, update Supabase:
- **Authentication → Site URL** → your production URL
- **Redirect URLs** → add `https://your-domain.com/auth/callback`

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) | Yes |
| `RESEND_API_KEY` | Resend API key for sending emails | Yes |
| `RESEND_FROM_EMAIL` | Sender email address (e.g. `noreply@yourcompany.com`) | Yes |
| `NEXT_PUBLIC_APP_URL` | Your app's public URL | Yes |
| `CRON_SECRET` | Secret token to authenticate cron job requests | Yes |
| `GROQ_API_KEY` | Groq API key for the AI assistant — comma-separate multiple keys for load balancing | Optional |
| `ACCOUNTS_EMAIL` | Accounts team email for finance notifications | Optional |
| `ADMIN_NOTIFY_EMAIL` | Admin email for system notifications | Optional |

See `.env.local.example` for the full list with descriptions.

---

## Cron Jobs

StaffPortal uses cron jobs for automated reminders and maintenance. GitHub Actions workflow files are included in `.github/workflows/` — add your `APP_URL` and `CRON_SECRET` as repository secrets to activate them.

Alternatively, configure them in `vercel.json` for Vercel Cron, or use any cron service that can call your API endpoints with the `Authorization: Bearer <CRON_SECRET>` header.

| Job | Endpoint | Recommended Schedule |
|-----|----------|---------------------|
| Birthday reminders | `/api/cron/birthday-reminder` | Daily 8am |
| Absent reminders | `/api/cron/absent-reminder` | Daily 10am |
| Missing attendance | `/api/cron/missing-attendance` | Daily 6pm |
| Forgotten clock-out | `/api/cron/forgotten-clockout` | Daily 8pm |
| Stretch reminder | `/api/cron/stretch-reminder` | Weekdays 2pm |
| IT ticket cleanup | `/api/cron/it-ticket-cleanup` | Weekly |

---

## Project Structure

```
staff-portal/
├── app/
│   ├── (app)/              # All authenticated app pages
│   │   ├── admin/          # Admin-only pages
│   │   ├── analytics/      # Attendance analytics
│   │   ├── expenses/       # Expense management
│   │   ├── help/           # Help & support
│   │   ├── leave/          # Leave management
│   │   ├── visitors/       # Visitor management
│   │   └── wellness/       # Wellness tracking
│   ├── (auth)/             # Auth pages (login, signup, reset)
│   ├── api/                # API routes and cron handlers
│   └── kiosk/              # Public kiosk (no auth required)
├── components/
│   ├── chat/               # AI assistant chat components
│   ├── layout/             # Sidebar, topbar
│   └── ui/                 # Shared shadcn/ui components
├── lib/
│   ├── actions/            # Server actions (all DB operations)
│   ├── email.ts            # Email sending via Resend
│   └── supabase/           # Supabase client utilities
├── supabase/
│   └── migrations/         # Database SQL migrations (run in order)
└── types/                  # TypeScript type definitions
```

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create a branch: `git checkout -b feature/your-feature`
3. Make your changes and test locally with `npm run dev`
4. Commit: `git commit -m "feat: your feature description"`
5. Push and open a Pull Request

Ideas for contributions:
- Mobile app (React Native / Expo)
- Slack / Teams integration
- Payroll export (Xero, QuickBooks)
- Shift scheduling and rota management
- Custom leave types per organisation
- Multi-language (i18n) support
- End-to-end tests (Playwright)

---

## License

[MIT License](LICENSE) — free to use, modify, and distribute for any purpose including commercial use.

---

## Support

Bug reports and feature requests: [GitHub Issues](https://github.com/your-github-username/staff-portal/issues)
