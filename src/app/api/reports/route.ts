import { NextRequest } from "next/server";
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

type Range = "month" | "quarter" | "year" | "custom";

function resolveRange(range: Range, fromStr?: string | null, toStr?: string | null) {
  const now = new Date();
  let from: Date;
  let to: Date = now;
  switch (range) {
    case "month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "quarter":
      from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      break;
    case "year":
      from = new Date(now.getFullYear(), 0, 1);
      break;
    case "custom":
      from = fromStr ? new Date(fromStr) : new Date(now.getFullYear(), now.getMonth(), 1);
      to = toStr ? new Date(toStr) : now;
      break;
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  // Round `to` to end-of-day for inclusivity on date-only inputs.
  if (toStr && toStr.length <= 10) {
    to = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);
  }
  return { from, to };
}

function balanceOf(inv: {
  items: { qty: number; unitPrice: number }[];
  discount: number;
  taxRate: number;
  payments: { amount: number; status: string }[];
}) {
  const { total } = invoiceTotals(inv);
  const paid = inv.payments
    .filter((p) => p.status === "CONFIRMED")
    .reduce((s, p) => s + p.amount, 0);
  return Math.max(0, total - paid);
}

export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  const orgId = ctx.user.organizationId;
  await sweepExpired(orgId);

  const { searchParams } = new URL(req.url);
  const range = (searchParams.get("range") as Range) || "month";
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const { from, to } = resolveRange(range, fromStr, toStr);

  // Invoices issued in range (with items + payments for totals)
  const invoicesInRange = await db.invoice.findMany({
    where: { organizationId: orgId, issueDate: { gte: from, lte: to } },
    include: { items: true, payments: true },
  });

  // Payments confirmed in range (with client for topClients)
  const paymentsInRange = await db.payment.findMany({
    where: {
      organizationId: orgId,
      status: "CONFIRMED",
      paidAt: { gte: from, lte: to },
    },
    include: { client: true },
  });

  // Proposals & contracts in range
  const proposalsInRange = await db.proposal.findMany({
    where: { organizationId: orgId, createdAt: { gte: from, lte: to } },
    select: { status: true },
  });
  const contractsInRange = await db.contract.findMany({
    where: { organizationId: orgId, createdAt: { gte: from, lte: to } },
    select: { status: true, amount: true },
  });

  // ── Totals ──────────────────────────────────────────────────────────
  let totalInvoiced = 0;
  const byStatus = new Map<string, { count: number; amount: number }>();
  for (const inv of invoicesInRange) {
    const { total } = invoiceTotals(inv);
    totalInvoiced += total;
    const cur = byStatus.get(inv.status) ?? { count: 0, amount: 0 };
    cur.count++;
    cur.amount += total;
    byStatus.set(inv.status, cur);
  }

  const totalCollected = paymentsInRange.reduce((s, p) => s + p.amount, 0);

  const totalOutstanding = invoicesInRange
    .filter((inv) => inv.status !== "DRAFT" && inv.status !== "CANCELED" && inv.status !== "PAID")
    .reduce((s, inv) => s + balanceOf(inv), 0);

  const totalOverdue = invoicesInRange
    .filter((inv) => inv.status === "OVERDUE")
    .reduce((s, inv) => s + balanceOf(inv), 0);

  // ── Revenue by month (last 12 months) ───────────────────────────────
  const allPayments = await db.payment.findMany({
    where: { organizationId: orgId, status: "CONFIRMED" },
    select: { amount: true, paidAt: true },
  });

  const revenueByMonth: { month: string; amount: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
    const amount = allPayments
      .filter((p) => {
        const d = new Date(p.paidAt);
        return d >= start && d < end;
      })
      .reduce((s, p) => s + p.amount, 0);
    revenueByMonth.push({ month: MONTHS_SHORT[ref.getMonth()], amount });
  }

  // ── Top clients (by total paid in range) ───────────────────────────
  const clientTotals = new Map<string, { id: string; name: string; total: number }>();
  for (const p of paymentsInRange) {
    const c = p.client;
    if (!c) continue;
    const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
    const cur = clientTotals.get(c.id) ?? { id: c.id, name, total: 0 };
    cur.total += p.amount;
    clientTotals.set(c.id, cur);
  }
  const topClients = Array.from(clientTotals.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // ── Acceptance rate ────────────────────────────────────────────────
  const acceptedCount = proposalsInRange.filter((p) => p.status === "ACCEPTED").length;
  const refusedCount = proposalsInRange.filter((p) => p.status === "REFUSED").length;
  const denom = acceptedCount + refusedCount;
  const acceptanceRate = denom > 0 ? Math.round((acceptedCount / denom) * 100) : 0;

  // ── Contract value (signed contracts amount in range) ──────────────
  const contractValue = contractsInRange
    .filter((c) => c.status === "SIGNED")
    .reduce((s, c) => s + c.amount, 0);

  return ok({
    totalInvoiced,
    totalCollected,
    totalOutstanding,
    totalOverdue,
    revenueByMonth,
    invoicesByStatus: Array.from(byStatus.entries()).map(([status, v]) => ({
      status,
      count: v.count,
      amount: v.amount,
    })),
    topClients,
    acceptanceRate,
    contractValue,
  });
}
