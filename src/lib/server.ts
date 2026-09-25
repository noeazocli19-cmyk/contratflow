import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, isRole, type Role } from "@/lib/permissions";

export { getCurrentUser };

export type RawAuthCtx = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

// Narrowed type: once getCtx() returns non-null, organizationId/organization sont
// garantis présents — un utilisateur peut brièvement exister sans organisation
// juste après sa création par Better Auth (avant que notre wrapper d'inscription
// n'en attache une), mais un tel utilisateur ne peut rien faire dans l'app —
// on le traite donc comme "pas encore connecté" ici plutôt que de laisser
// `string | null` se propager dans chaque route.
export type AuthCtx = Omit<RawAuthCtx, "user"> & {
  user: Omit<RawAuthCtx["user"], "organizationId" | "organization"> & {
    organizationId: string;
    organization: NonNullable<RawAuthCtx["user"]["organization"]>;
  };
};

export async function getCtx(): Promise<AuthCtx | null> {
  const c = await getCurrentUser();
  if (!c || !c.user.organizationId || !c.user.organization) return null;
  return c as AuthCtx;
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Throws an Error if the current user's role doesn't have `permission`.
 * Use inside route handlers after `getCtx()`.
 * Throws "Permission refusée" — catch with try/catch and return err().
 */
export function assertCan(ctx: AuthCtx, permission: string): void {
  const role = isRole(ctx.user.role) ? (ctx.user.role as Role) : undefined;
  if (!can(role, permission)) {
    const e = new Error("Permission refusée");
    (e as Error & { status?: number }).status = 403;
    throw e;
  }
}

/**
 * Convenience wrapper: returns the auth context or an err() response if not authed.
 * Otherwise null if everything is fine.
 */
export async function requireCtx(): Promise<{ ctx: AuthCtx; error: null } | { ctx: null; error: NextResponse }> {
  const ctx = await getCtx();
  if (!ctx) return { ctx: null, error: err("Non authentifié", 401) };
  return { ctx, error: null };
}

const CHARSETS = {
  token: "abcdefghijklmnopqrstuvwxyz0123456789",
};

export function genToken(n = 32) {
  const chars = CHARSETS.token;
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function nextNumber(
  organizationId: string,
  model: "proposal" | "quote" | "contract" | "invoice",
) {
  const year = new Date().getFullYear();
  const prefix = {
    proposal: "PROP",
    quote: "DEVIS",
    contract: "CONTRAT",
    invoice: "INV",
  }[model];
  const startsWith = `${prefix}-${year}-`;
  const where = { organizationId, number: { startsWith } } as const;
  let count = 0;
  if (model === "proposal") count = await db.proposal.count({ where });
  else if (model === "quote") count = await db.quote.count({ where });
  else if (model === "contract") count = await db.contract.count({ where });
  else count = await db.invoice.count({ where });
  return `${prefix}-${year}-${String(count + 1).padStart(3, "0")}`;
}

// Compute invoice totals
export function invoiceTotals(invoice: {
  items: { qty: number; unitPrice: number }[];
  discount: number;
  taxRate: number;
}) {
  const subtotal = invoice.items.reduce((s, it) => s + (it.qty || 0) * (it.unitPrice || 0), 0);
  const discountAmount = subtotal * ((invoice.discount || 0) / 100);
  const taxableBase = subtotal - discountAmount;
  const taxAmount = taxableBase * ((invoice.taxRate || 0) / 100);
  const total = Math.round(taxableBase + taxAmount);
  return { subtotal, discountAmount, taxableBase, taxAmount, total };
}

// Recompute invoice status based on payments + due date
export async function recomputeInvoiceStatus(invoiceId: string) {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { items: true, payments: true },
  });
  if (!invoice) return null;
  const { total } = invoiceTotals(invoice);
  const paid = invoice.payments
    .filter((p) => p.status === "CONFIRMED")
    .reduce((s, p) => s + p.amount, 0);

  let status = invoice.status;
  if (total > 0 && paid >= total) status = "PAID";
  else if (paid > 0) status = "PARTIALLY_PAID";
  else if (invoice.status === "DRAFT") status = "DRAFT";
  else if (invoice.dueDate && new Date(invoice.dueDate) < new Date()) status = "OVERDUE";
  else status = invoice.status === "OVERDUE" ? "SENT" : invoice.status;

  await db.invoice.update({
    where: { id: invoiceId },
    data: { status, paidAt: status === "PAID" ? new Date() : null },
  });
  return { total, paid, status };
}

// Auto-create notification
export async function notify(
  organizationId: string,
  type: string,
  title: string,
  message: string,
  link?: string,
) {
  await db.notification.create({
    data: { organizationId, type, title, message, link: link ?? null },
  });
}

// Auto-create timeline event
export async function timeline(
  clientId: string,
  type: string,
  message: string,
  opts: {
    proposalId?: string;
    contractId?: string;
    projectId?: string;
    invoiceId?: string;
  } = {},
) {
  await db.timelineEvent.create({
    data: { clientId, type, message, ...opts },
  });
}

// Append an audit log entry for the org. Failures are non-fatal — we don't
// want an audit write to break the main mutation.
export async function audit(
  organizationId: string,
  userId: string | undefined,
  action: string,
  target: string | undefined,
  message: string,
  metadata?: Record<string, unknown>,
) {
  try {
    await db.auditLog.create({
      data: {
        organizationId,
        userId: userId ?? null,
        action,
        target: target ?? null,
        message,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch {
    // swallow — audit logging must never break the main flow
  }
}

// Workflow: contract signed → create project + payment plan + deposit invoice + notifications
export async function onContractSigned(contractId: string, byName?: string) {
  const contract = await db.contract.findUnique({ where: { id: contractId } });
  if (!contract) return null;
  await db.contract.update({
    where: { id: contractId },
    data: { status: "SIGNED", signedAt: new Date() },
  });

  // 1. Create project if none
  let project = await db.project.findUnique({ where: { contractId } });
  if (!project) {
    project = await db.project.create({
      data: {
        organizationId: contract.organizationId,
        clientId: contract.clientId,
        contractId: contract.id,
        name: contract.title,
        budget: contract.amount,
        startDate: contract.startDate ?? new Date(),
        endDate: contract.endDate ?? null,
        status: "TODO",
      },
    });
    await timeline(
      contract.clientId,
      "PROJECT_STARTED",
      `Projet « ${project.name} » créé`,
      { projectId: project.id, contractId: contract.id },
    );
  }

  // 2. Create payment plan + deposit invoice if none
  let depositInvoice = await db.invoice.findFirst({
    where: { contractId, type: "DEPOSIT" },
  });
  if (!depositInvoice) {
    const deposit = Math.round(contract.amount * 0.3);
    const balance = contract.amount - deposit;
    const plan = await db.paymentPlan.create({
      data: {
        contractId,
        totalAmount: contract.amount,
        installments: {
          create: [
            {
              label: "Acompte 30%",
              amount: deposit,
              dueDate: new Date(),
              order: 0,
              status: "UPCOMING",
            },
            {
              label: "Solde 70%",
              amount: balance,
              dueDate: contract.endDate ?? null,
              order: 1,
              status: "UPCOMING",
            },
          ],
        },
      },
    });
    const invNumber = await nextNumber(contract.organizationId, "invoice");
    depositInvoice = await db.invoice.create({
      data: {
        organizationId: contract.organizationId,
        clientId: contract.clientId,
        contractId: contract.id,
        projectId: project.id,
        number: invNumber,
        type: "DEPOSIT",
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        status: "DRAFT",
        items: {
          create: [{ title: `Acompte 30% — ${contract.title}`, unitPrice: deposit }],
        },
      },
    });
    await db.installment.updateMany({
      where: { paymentPlanId: plan.id, order: 0 },
      data: { invoiceId: depositInvoice.id },
    });
  }

  await notify(
    contract.organizationId,
    "CONTRACT_SIGNED",
    "Contrat signé",
    `${byName ? byName + " a " : ""}signé le contrat ${contract.number}.`,
    "contracts",
  );
  await timeline(
    contract.clientId,
    "CONTRACT_SIGNED",
    `Contrat ${contract.number} signé`,
    { contractId: contract.id, projectId: project.id },
  );
  return { project, depositInvoice };
}

// Workflow: payment received → update invoice + installment + notify
export async function onPaymentReceived(
  invoiceId: string | null,
  amount: number,
  organizationId: string,
  clientId: string,
) {
  if (!invoiceId) return;
  await recomputeInvoiceStatus(invoiceId);
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (invoice) {
    // Mark linked installment as paid
    const inst = await db.installment.findUnique({ where: { invoiceId } });
    if (inst) {
      await db.installment.update({ where: { id: inst.id }, data: { status: "PAID" } });
    }
    await notify(
      organizationId,
      "PAYMENT_RECEIVED",
      "Paiement reçu",
      `Paiement de ${amount.toLocaleString("fr-FR")} FCFA reçu pour la facture ${invoice.number}.`,
      "payments",
    );
    await timeline(clientId, "PAYMENT_RECEIVED", `Paiement de ${amount.toLocaleString("fr-FR")} FCFA reçu`, { invoiceId });
  }
}

// Mark expired proposals/quotes/invoices (sweep)
export async function sweepExpired(organizationId: string) {
  const now = new Date();
  await db.proposal.updateMany({
    where: { organizationId, status: "SENT", validUntil: { lt: now } },
    data: { status: "EXPIRED" },
  });
  await db.quote.updateMany({
    where: { organizationId, status: "SENT", expirationDate: { lt: now } },
    data: { status: "EXPIRED" },
  });
  await db.invoice.updateMany({
    where: { organizationId, status: "SENT", dueDate: { lt: now } },
    data: { status: "OVERDUE" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin guard — only OWNER role can perform sensitive operations
// (changing plan, deleting org, managing members, etc.)
// ─────────────────────────────────────────────────────────────────────────────
export function assertOwner(ctx: AuthCtx): NextResponse | null {
  if (ctx.user.role !== "OWNER") {
    return NextResponse.json(
      { error: "Réservé au propriétaire de l'organisation." },
      { status: 403 },
    );
  }
  return null;
}
