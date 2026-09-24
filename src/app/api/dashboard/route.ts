import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";
import { invoiceTotals, sweepExpired } from "@/lib/server";

const MONTHS_SHORT = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  const orgId = ctx.user.organizationId;
  await sweepExpired(orgId);

  const now = new Date();
  const monthStart = startOfMonth(now);

  // ── Revenue ─────────────────────────────────────────────────────────
  const payments = await db.payment.findMany({
    where: { organizationId: orgId, status: "CONFIRMED" },
    select: { amount: true, paidAt: true },
  });

  const collected = payments.reduce((s, p) => s + p.amount, 0);
  const thisMonth = payments
    .filter((p) => new Date(p.paidAt) >= monthStart)
    .reduce((s, p) => s + p.amount, 0);

  // Pending + overdue invoices need totals + paid amounts
  const pendingInvoices = await db.invoice.findMany({
    where: {
      organizationId: orgId,
      status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID"] },
    },
    include: { items: true, payments: true },
  });

  const overdueInvoices = await db.invoice.findMany({
    where: { organizationId: orgId, status: "OVERDUE" },
    include: { items: true, payments: true },
  });

  function balanceOf(inv: (typeof pendingInvoices)[number]) {
    const { total } = invoiceTotals(inv);
    const paid = inv.payments
      .filter((p) => p.status === "CONFIRMED")
      .reduce((s, p) => s + p.amount, 0);
    return Math.max(0, total - paid);
  }

  const pending = pendingInvoices.reduce((s, inv) => s + balanceOf(inv), 0);
  const overdue = overdueInvoices.reduce((s, inv) => s + balanceOf(inv), 0);

  // ── Pipeline ───────────────────────────────────────────────────────
  const prospects = await db.prospect.count({
    where: {
      organizationId: orgId,
      status: { in: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION"] },
    },
  });
  const proposalsSent = await db.proposal.count({
    where: { organizationId: orgId, status: "SENT" },
  });
  const proposalsViewed = await db.proposal.count({
    where: { organizationId: orgId, status: "VIEWED" },
  });
  const contractsSent = await db.contract.count({
    where: { organizationId: orgId, status: "SENT" },
  });
  const contractsSigned = await db.contract.count({
    where: { organizationId: orgId, status: "SIGNED" },
  });

  // ── Projects ───────────────────────────────────────────────────────
  const activeProjects = await db.project.count({
    where: { organizationId: orgId, status: "IN_PROGRESS" },
  });
  const doneProjects = await db.project.count({
    where: { organizationId: orgId, status: "DONE" },
  });
  const lateProjects = await db.project.count({
    where: {
      organizationId: orgId,
      status: { not: "DONE" },
      endDate: { lt: now },
    },
  });

  // ── Invoices ───────────────────────────────────────────────────────
  const draftInvoices = await db.invoice.count({
    where: { organizationId: orgId, status: "DRAFT" },
  });
  const sentInvoices = await db.invoice.count({
    where: { organizationId: orgId, status: "SENT" },
  });
  const paidInvoices = await db.invoice.count({
    where: { organizationId: orgId, status: "PAID" },
  });
  const overdueInvoicesCount = await db.invoice.count({
    where: { organizationId: orgId, status: "OVERDUE" },
  });

  // ── Activity (latest 10 timeline events) ───────────────────────────
  const activity = await db.timelineEvent.findMany({
    where: { client: { organizationId: orgId } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // ── Revenue series (last 6 months) ─────────────────────────────────
  const revenueSeries: { month: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = startOfMonth(ref);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
    const amount = payments
      .filter((p) => {
        const d = new Date(p.paidAt);
        return d >= start && d < end;
      })
      .reduce((s, p) => s + p.amount, 0);
    revenueSeries.push({ month: MONTHS_SHORT[ref.getMonth()], amount });
  }

  // ── Notifications (latest 5 unread) ─────────────────────────────────
  const notifications = await db.notification.findMany({
    where: { organizationId: orgId, read: false },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return ok({
    revenue: { thisMonth, collected, pending, overdue },
    pipeline: { prospects, proposalsSent, proposalsViewed, contractsSent, contractsSigned },
    projects: { active: activeProjects, done: doneProjects, late: lateProjects },
    invoices: {
      draft: draftInvoices,
      sent: sentInvoices,
      paid: paidInvoices,
      overdue: overdueInvoicesCount,
    },
    activity,
    revenueSeries,
    notifications,
  });
}
