# ContractFlow — Build Contract (READ FIRST)

This document is the single source of truth for all subagents working on ContractFlow.
Read `/home/z/my-project/worklog.md` before starting, and APPEND your own work log entry when done.

## 1. Architecture

- **Single user-visible route**: `/` (in `src/app/page.tsx`). All other "pages" are rendered inside this single page using Zustand-driven client-side view routing.
- **Public portals** (proposal / contract / invoice) are accessed via query params: `?portal=proposal&token=abc123` (or `contract`, `invoice`). The store auto-detects them and renders the corresponding portal component **without auth**.
- **DB**: Prisma + SQLite. Schema is already finalized at `prisma/schema.prisma` and pushed. Import via `import { db } from "@/lib/db"`.
- **Auth**: JWT cookie sessions via `@/lib/auth`. Helpers `getCurrentUser`, `setSessionCookie`, `clearSessionCookie`, `hashPassword`, `verifyPassword`. Cookie name `cf_session`.
- **Backend helpers**: `@/lib/server` exposes `getCtx()`, `ok()`, `err()`, `genToken()`, `nextNumber()`, `invoiceTotals()`, `recomputeInvoiceStatus()`, `notify()`, `timeline()`, `onContractSigned()`, `onPaymentReceived()`, `sweepExpired()`.
- **Shared types**: `@/lib/types` (User, Org, Prospect, Client, Proposal, Quote, Contract, Project, Task, Invoice, Payment, Installment, PaymentPlan, Notification, TimelineEvent, Document, DashboardData, ReportData).
- **Format/labels**: `@/lib/format` (formatCurrency, formatDate, timeAgo, initials, all `*_STATUS_LABELS`, `STATUS_COLOR`).
- **API client**: `@/lib/api` exposes `api.get/post/put/patch/del`, throws `ApiError`.
- **Store**: `@/lib/store` (Zustand). Use `useStore` to read `user`, `org`, `view`, `params`, `navigate(view, params)`, `bump()` (forces refetch), `setPortal`, `logout`.
- **UI**: shadcn/ui (all components exist in `src/components/ui`). Lucide icons. **Do not use indigo/blue**. Use Tailwind 4 tokens (`bg-card`, `bg-muted`, `text-primary`, etc.).

## 2. Conventions

- Frontend components: `"use client"` at top, default export, accept any props needed.
- Backend routes: import `getCurrentUser` from `@/lib/auth` (or `getCtx`, `ok`, `err` from `@/lib/server`). **Always** enforce tenancy: filter by `user.organizationId`.
- Number format: `PROP-2026-001`, `DEVIS-2026-001`, `CONTRAT-2026-001`, `INV-2026-001`. Use `nextNumber(orgId, model)`.
- Public tokens: 32-char string via `genToken()`.
- Date handling: store as ISO strings in API responses (Prisma returns Date objects; serialize via `.toISOString()`). Frontend uses `formatDate()`.
- Money: stored as Float (FCFA). Frontend formats via `formatCurrency(amount, currency)`.

## 3. API surface (already contracted — frontend depends on these exact paths)

### Auth
- `POST /api/auth/register` `{ email, password, name, orgName }` → `{ user, organization }`
- `POST /api/auth/login` `{ email, password }` → `{ user, organization }`
- `POST /api/auth/logout` → `{}`
- `GET /api/auth/me` → `{ user, organization }` | 401
- `POST /api/onboarding` `{ step, fields }` → updates org/user; returns `{ user, organization }`
- `POST /api/onboarding/complete` → sets onboardingStep=9, returns `{ user, organization }`

### Dashboard / Search / Notifications / Settings / Reports
- `GET /api/dashboard` → `DashboardData`
- `GET /api/search?q=` → `{ clients, prospects, invoices, contracts, proposals, projects }` (arrays of `{ id, number/name, name? }`)
- `GET /api/notifications` → `Notification[]`; `GET /api/notifications?count=true` → `{ count }`
- `PATCH /api/notifications/:id` `{ read: true }`; `POST /api/notifications/read-all`
- `GET /api/organization` → org; `PATCH /api/organization` `{ ...fields }` → org
- `GET /api/settings` → `{ user, organization }`; `PATCH /api/settings` `{ name?, phone?, ...orgFields }`
- `GET /api/reports?range=month|quarter|year` → `ReportData`

### Prospects
- `GET /api/prospects` → `Prospect[]`
- `POST /api/prospects` `{ name, company?, email?, phone?, sector?, source?, status?, notes?, potentialValue? }`
- `GET /api/prospects/:id`; `PATCH /api/prospects/:id`; `DELETE /api/prospects/:id`
- `POST /api/prospects/:id/convert` → creates a Client from prospect, sets `convertedClientId`, returns `{ client }`

### Clients
- `GET /api/clients` → `Client[]`
- `POST /api/clients` `{ firstName, lastName, company?, email?, phone?, address?, country?, taxId?, notes? }`
- `GET /api/clients/:id` → Client with stats `{ client, stats: { totalValue, totalPaid, balance, projectsCount, contractsCount, invoicesCount }, timeline: TimelineEvent[] }`
- `PATCH /api/clients/:id`; `DELETE /api/clients/:id`

### Proposals
- `GET /api/proposals` → `Proposal[]` (with items + client)
- `POST /api/proposals` `{ clientId, title, problem?, solution?, deliverables?, timeline?, amount?, currency?, conditions?, options?, validUntil?, notes?, items?: [{ title, description?, qty?, unitPrice? }] }`
- `GET /api/proposals/:id`; `PATCH /api/proposals/:id`
- `POST /api/proposals/:id/send` → sets status SENT, sets sentAt, ensures publicToken, returns `{ publicToken }`
- `POST /api/proposals/:id/items`; `PATCH /api/proposals/:id/items/:itemId`; `DELETE /api/proposals/:id/items/:itemId`

### Quotes — same shape as Proposals but with `discount`, `taxRate`, `expirationDate`
- `GET /api/quotes`, `POST /api/quotes`, `GET /api/quotes/:id`, `PATCH /api/quotes/:id`
- `POST /api/quotes/:id/send` → `{ publicToken }`
- Items: `POST /api/quotes/:id/items`, `PATCH /api/quotes/:id/items/:itemId`, `DELETE /api/quotes/:id/items/:itemId`

### Contracts
- `GET /api/contracts` → `Contract[]` (with client)
- `POST /api/contracts` `{ clientId, proposalId?, title, content, amount, currency?, startDate?, endDate?, duration?, conditions? }`
- `GET /api/contracts/:id` → Contract with `signatures`, `project`, `paymentPlan` (+ installments), `invoices`, `client`
- `PATCH /api/contracts/:id`
- `POST /api/contracts/:id/send` → status SENT, publicToken, returns `{ publicToken }`
- `POST /api/contracts/:id/from-proposal` `{ proposalId }` → creates contract from accepted proposal (auto), returns contract

### Contract Templates
- `GET /api/contract-templates`; `POST /api/contract-templates`; `GET /api/contract-templates/:id`; `PATCH /api/contract-templates/:id`; `DELETE /api/contract-templates/:id`
- `POST /api/contract-templates/:id/instantiate` `{ clientId, amount?, startDate?, endDate? }` → creates contract from template, replaces `{{client_name}}`, `{{company_name}}`, `{{project_name}}`, `{{amount}}`, `{{start_date}}`, `{{end_date}}`

### Projects & Tasks
- `GET /api/projects` → `Project[]` (with client)
- `POST /api/projects` `{ clientId, contractId?, name, description?, budget?, startDate?, endDate? }`
- `GET /api/projects/:id` → Project with `tasks[]`, `client`
- `PATCH /api/projects/:id`
- `POST /api/projects/:id/tasks` `{ title, description?, status?, priority?, dueDate?, assigneeId? }`
- `PATCH /api/projects/:id/tasks/:taskId` `{ status?, priority?, title?, description?, dueDate?, order? }`
- `DELETE /api/projects/:id/tasks/:taskId`

### Invoices
- `GET /api/invoices` → `Invoice[]` (with client, items)
- `POST /api/invoices` `{ clientId, projectId?, contractId?, type?, issueDate?, dueDate?, notes?, terms?, discount?, taxRate?, items?: [{ title, description?, qty?, unitPrice? }] }`
- `GET /api/invoices/:id` → Invoice with `items`, `payments`, `client`, computed `subtotal`, `discountAmount`, `taxAmount`, `total`, `paidAmount`, `balance`
- `PATCH /api/invoices/:id`
- `POST /api/invoices/:id/send` → status SENT, publicToken, returns `{ publicToken }`
- `POST /api/invoices/:id/items`; `PATCH /api/invoices/:id/items/:itemId`; `DELETE /api/invoices/:id/items/:itemId`

### Payments
- `GET /api/payments` → `Payment[]` (with client, invoice)
- `POST /api/payments` `{ clientId, invoiceId?, amount, method, reference?, note?, paidAt? }` → creates payment, calls `onPaymentReceived` (auto-updates invoice/installment/notifications)
- `GET /api/payments/:id`; `DELETE /api/payments/:id`

### Documents
- `GET /api/documents?clientId=&projectId=&contractId=&invoiceId=&proposalId=` → `Document[]`
- `POST /api/documents` `{ name, type, url?, clientId?, projectId?, contractId?, invoiceId?, proposalId?, mime?, size? }`
- `DELETE /api/documents/:id`

### Public portals (NO auth)
- `GET /api/public/proposal/:token` → proposal + client + items; auto-marks VIEWED if first view; returns `{ proposal, client, items, organization }`
- `POST /api/public/proposal/:token/accept` `{ decision: 'ACCEPT' | 'REFUSE', message? }` → updates proposal status to ACCEPTED/REFUSED, sets acceptedAt/refusedAt; if ACCEPTED triggers notification + timeline
- `GET /api/public/contract/:token` → contract + client + signatures + organization; auto-marks VIEWED
- `POST /api/public/contract/:token/sign` `{ signedBy, signedByEmail, signatureData }` → creates Signature, calls `onContractSigned` (auto-creates project + payment plan + deposit invoice + notifications)
- `GET /api/public/invoice/:token` → invoice + client + items + payments + organization; auto-marks VIEWED
- `POST /api/public/invoice/:token/pay` `{ method, reference?, amount? }` → creates Payment (status CONFIRMED), calls `onPaymentReceived`

## 4. Frontend view → component mapping (already wired in `src/app/page.tsx`)

| View | Component | Notes |
|------|-----------|-------|
| login (unauth) | `src/components/auth/Login.tsx` | Shows login form + link to register + demo button |
| register (unauth) | `src/components/auth/Register.tsx` | Creates org + user, redirects to onboarding |
| onboarding | `src/components/app/Onboarding.tsx` | 9-step wizard, calls `/api/onboarding` per step, finishes with `/api/onboarding/complete` |
| dashboard | `src/components/app/Dashboard.tsx` | Stats cards + revenue chart (recharts) + pipeline + activity timeline + recent notifications |
| prospects | `src/components/app/Prospects.tsx` | Table + create dialog + convert-to-client action + status badges |
| clients | `src/components/app/Clients.tsx` | Cards/table + create dialog |
| client-detail | `src/components/app/ClientDetail.tsx` | Summary + tabs (overview/timeline/proposals/contracts/projects/invoices/documents) |
| proposals | `src/components/app/Proposals.tsx` | List + create dialog + "send" action with public link copy |
| proposal-detail | `src/components/app/ProposalDetail.tsx` | Sections (problem/solution/deliverables/timeline/amount/conditions) + items + status + send + public link |
| quotes | `src/components/app/Quotes.tsx` | List + create dialog with line items + send |
| contracts | `src/components/app/Contracts.tsx` | List + create from template + send |
| contract-detail | `src/components/app/ContractDetail.tsx` | Content preview + signatures + payment plan + linked project + invoices |
| projects | `src/components/app/Projects.tsx` | List/grid + create dialog |
| project-detail | `src/components/app/ProjectDetail.tsx` | Overview + Kanban tasks (drag with `@dnd-kit`) + budget/progress |
| invoices | `src/components/app/Invoices.tsx` | List + create dialog with items + send + status badge |
| invoice-detail | `src/components/app/InvoiceDetail.tsx` | Line items + totals + payments + send + public link + record payment |
| payments | `src/components/app/Payments.tsx` | List + record payment dialog |
| documents | `src/components/app/Documents.tsx` | List by association + upload-by-URL dialog |
| reports | `src/components/app/Reports.tsx` | Period filter + KPI cards + revenue chart + status breakdown + top clients + CSV export |
| settings | `src/components/app/Settings.tsx` | Org profile form + billing (subscription plan) + notifications prefs |
| notifications | `src/components/app/Notifications.tsx` | List + mark read + mark all |

## 5. UI guidelines

- Use shadcn/ui components from `src/components/ui`. Lucide icons.
- Avoid indigo/blue. Use neutral + emerald/cyan/amber/rose for status colors (helpers in `format.ts`).
- Sticky footer is already handled by `Shell.tsx` — module components render inside `<div className="flex-1 p-4 sm:p-6">`.
- Cards: `p-4` or `p-6`, `gap-4` between cards. Long lists: `max-h-96 overflow-y-auto`.
- Responsive: mobile-first; tables become cards on mobile (`hidden md:table` for table + `md:hidden` for cards).
- Use `useStore().navigate(view, params)` for in-app navigation. Use `useStore().bump()` after mutations to refresh dependent views.
- Use `useToast()` from `@/hooks/use-toast` for feedback.
- Use `api.get/post/...` from `@/lib/api`. Catch `ApiError`.
- Format currency with `formatCurrency(amount, currency)`. Dates with `formatDate()`. Status badges use `STATUS_COLOR[status]` + `*_STATUS_LABELS[status]` from `@/lib/format`.
- All forms: validation, loading states, error messages, toast on success/failure.
- Empty states: nice empty state with icon + message + CTA (never blank).

## 6. Demo credentials

- Email: `demo@contractflow.app`
- Password: `demodemo`

## 7. Worklog protocol

Before starting: read `/home/z/my-project/worklog.md` to see prior work.
After finishing: APPEND (do not overwrite) a new section starting with `---`:

```markdown
---
Task ID: <your task id>
Agent: <your name>
Task: <the task you were asked to do>

Work Log:
- <step 1>
- <step 2>

Stage Summary:
- <key results / files created>
```

## 8. Next.js 16 route handler syntax (IMPORTANT)

```ts
// src/app/api/prospects/route.ts
import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const items = await db.prospect.findMany({
    where: { organizationId: ctx.user.organizationId },
    orderBy: { createdAt: "desc" },
  });
  return ok(items.map(serialize));
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const body = await req.json();
  // validate...
  const created = await db.prospect.create({
    data: { ...body, organizationId: ctx.user.organizationId },
  });
  return ok(created, 201);
}
```

```ts
// src/app/api/prospects/[id]/route.ts
import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const item = await db.prospect.findFirst({ where: { id, organizationId: ctx.user.organizationId } });
  if (!item) return err("Introuvable", 404);
  return ok(item);
}
```

**Always**:
- `await params` (it's a Promise in Next 16)
- `await req.json()`
- Filter by `ctx.user.organizationId` for tenancy
- Use `findFirst` (not `findUnique`) for tenant queries when joining on org
- Return Prisma objects directly (NextResponse serializes Date fields)

