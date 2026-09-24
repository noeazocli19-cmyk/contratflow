import { NextRequest } from "next/server";
import { ok, err, invoiceTotals } from "@/lib/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const client = await db.client.findUnique({
    where: { portalToken: token },
    include: { organization: true },
  });
  if (!client) return err("Portail client introuvable", 404);

  const org = client.organization;

  // ---- Proposals (only SENT/VIEWED/ACCEPTED/REFUSED, not DRAFT) ----
  const proposalsRaw = await db.proposal.findMany({
    where: {
      clientId: client.id,
      status: { in: ["SENT", "VIEWED", "ACCEPTED", "REFUSED", "EXPIRED"] },
    },
    orderBy: { updatedAt: "desc" },
  });
  const proposals = proposalsRaw.map((p) => ({
    id: p.id,
    number: p.number,
    title: p.title,
    status: p.status,
    amount: p.amount,
    currency: p.currency,
    publicToken: p.publicToken,
    validUntil: p.validUntil,
    sentAt: p.sentAt,
    viewedAt: p.viewedAt,
    acceptedAt: p.acceptedAt,
    refusedAt: p.refusedAt,
    updatedAt: p.updatedAt,
  }));

  // ---- Quotes (only non-DRAFT) ----
  const quotesRaw = await db.quote.findMany({
    where: {
      clientId: client.id,
      status: { in: ["SENT", "VIEWED", "ACCEPTED", "REFUSED", "EXPIRED"] },
    },
    include: { items: true },
    orderBy: { updatedAt: "desc" },
  });
  const quotes = quotesRaw.map((q) => {
    const totals = invoiceTotals({
      items: q.items.map((it) => ({ qty: it.qty, unitPrice: it.unitPrice })),
      discount: q.discount,
      taxRate: q.taxRate,
    });
    return {
      id: q.id,
      number: q.number,
      status: q.status,
      totalComputed: totals.total,
      publicToken: q.publicToken,
      expirationDate: q.expirationDate,
      issueDate: q.issueDate,
      sentAt: q.sentAt,
      viewedAt: q.viewedAt,
      acceptedAt: q.acceptedAt,
      refusedAt: q.refusedAt,
      updatedAt: q.updatedAt,
    };
  });

  // ---- Contracts (only SENT/VIEWED/SIGNED, not DRAFT) ----
  const contractsRaw = await db.contract.findMany({
    where: {
      clientId: client.id,
      status: { in: ["SENT", "VIEWED", "SIGNED", "EXPIRED", "CANCELED"] },
    },
    orderBy: { updatedAt: "desc" },
  });
  const contracts = contractsRaw.map((c) => ({
    id: c.id,
    number: c.number,
    title: c.title,
    status: c.status,
    amount: c.amount,
    publicToken: c.publicToken,
    signedAt: c.signedAt,
    sentAt: c.sentAt,
    viewedAt: c.viewedAt,
    updatedAt: c.updatedAt,
  }));

  // ---- Invoices (only SENT/VIEWED/PARTIALLY_PAID/PAID/OVERDUE, not DRAFT/CANCELED) ----
  const invoicesRaw = await db.invoice.findMany({
    where: {
      clientId: client.id,
      status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "PAID", "OVERDUE"] },
    },
    include: { items: true, payments: true },
    orderBy: { updatedAt: "desc" },
  });
  const invoices = invoicesRaw.map((inv) => {
    const totals = invoiceTotals({
      items: inv.items.map((it) => ({ qty: it.qty, unitPrice: it.unitPrice })),
      discount: inv.discount,
      taxRate: inv.taxRate,
    });
    const paidAmount = inv.payments
      .filter((p) => p.status === "CONFIRMED")
      .reduce((s, p) => s + p.amount, 0);
    const balance = Math.max(0, totals.total - paidAmount);
    return {
      id: inv.id,
      number: inv.number,
      type: inv.type,
      status: inv.status,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      totalComputed: totals.total,
      publicToken: inv.publicToken,
      paidAmount,
      balance,
      sentAt: inv.sentAt,
      viewedAt: inv.viewedAt,
      paidAt: inv.paidAt,
      updatedAt: inv.updatedAt,
    };
  });

  // ---- Payments (CONFIRMED only) ----
  const paymentsRaw = await db.payment.findMany({
    where: { clientId: client.id, status: "CONFIRMED" },
    include: { invoice: true },
    orderBy: { paidAt: "desc" },
  });
  const payments = paymentsRaw.map((p) => ({
    id: p.id,
    amount: p.amount,
    method: p.method,
    reference: p.reference,
    paidAt: p.paidAt,
    invoiceNumber: p.invoice?.number ?? null,
  }));

  // ---- Documents attached to this client ----
  const documentsRaw = await db.document.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "desc" },
  });
  const documents = documentsRaw.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    url: d.url,
    mime: d.mime,
    size: d.size,
    createdAt: d.createdAt,
  }));

  // ---- Pending actions ----
  type PendingAction =
    | {
        type: "sign_contract";
        id: string;
        number: string;
        title: string;
        amount: number;
        publicToken: string | null;
      }
    | {
        type: "pay_invoice";
        id: string;
        number: string;
        amount: number;
        balance: number;
        publicToken: string | null;
      }
    | {
        type: "accept_proposal";
        id: string;
        number: string;
        title: string;
        amount: number;
        publicToken: string | null;
      }
    | {
        type: "accept_quote";
        id: string;
        number: string;
        amount: number;
        publicToken: string | null;
      };

  const pendingActions: PendingAction[] = [];

  for (const c of contractsRaw) {
    if (c.status === "SENT" || c.status === "VIEWED") {
      pendingActions.push({
        type: "sign_contract",
        id: c.id,
        number: c.number,
        title: c.title,
        amount: c.amount,
        publicToken: c.publicToken,
      });
    }
  }

  for (const inv of invoices) {
    if (
      inv.publicToken &&
      (inv.status === "SENT" ||
        inv.status === "VIEWED" ||
        inv.status === "PARTIALLY_PAID" ||
        inv.status === "OVERDUE") &&
      inv.balance > 0.01
    ) {
      pendingActions.push({
        type: "pay_invoice",
        id: inv.id,
        number: inv.number,
        amount: inv.totalComputed,
        balance: inv.balance,
        publicToken: inv.publicToken,
      });
    }
  }

  for (const p of proposalsRaw) {
    if (p.publicToken && (p.status === "SENT" || p.status === "VIEWED")) {
      pendingActions.push({
        type: "accept_proposal",
        id: p.id,
        number: p.number,
        title: p.title,
        amount: p.amount,
        publicToken: p.publicToken,
      });
    }
  }

  for (const q of quotesRaw) {
    if (q.publicToken && (q.status === "SENT" || q.status === "VIEWED")) {
      const totals = invoiceTotals({
        items: q.items.map((it) => ({ qty: it.qty, unitPrice: it.unitPrice })),
        discount: q.discount,
        taxRate: q.taxRate,
      });
      pendingActions.push({
        type: "accept_quote",
        id: q.id,
        number: q.number,
        amount: totals.total,
        publicToken: q.publicToken,
      });
    }
  }

  return ok({
    client: {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      company: client.company,
      email: client.email,
      phone: client.phone,
      address: client.address,
      country: client.country,
    },
    organization: {
      name: org.name,
      logoUrl: org.logoUrl,
      email: org.email,
      phone: org.phone,
      address: org.address,
      currency: org.currency,
    },
    proposals,
    quotes,
    contracts,
    invoices,
    payments,
    documents,
    pendingActions,
  });
}
