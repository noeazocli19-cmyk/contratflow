import { NextRequest } from "next/server";
import { getCtx, ok, err, nextNumber, invoiceTotals, timeline, audit } from "@/lib/server";
import { db } from "@/lib/db";
import { checkLimit, startOfMonth } from "@/lib/plans";

export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const items = await db.invoice.findMany({
    where: { organizationId: ctx.user.organizationId },
    include: { items: true, client: true },
    orderBy: { issueDate: "desc" },
  });
  // Attach computed totals
  const result = items.map((inv) => {
    const totals = invoiceTotals(inv);
    return { ...inv, ...totals };
  });
  return ok(result);
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const body = await req.json();
  const {
    clientId,
    projectId,
    contractId,
    type,
    issueDate,
    dueDate,
    notes,
    terms,
    discount,
    taxRate,
    items,
  } = body || {};

  if (!clientId) return err("clientId est requis", 400);

  const client = await db.client.findFirst({
    where: { id: clientId, organizationId: ctx.user.organizationId },
  });
  if (!client) return err("Client introuvable", 404);

  if (contractId) {
    const contract = await db.contract.findFirst({
      where: { id: contractId, organizationId: ctx.user.organizationId },
    });
    if (!contract) return err("Contrat introuvable", 404);
  }

  if (projectId) {
    const project = await db.project.findFirst({
      where: { id: projectId, organizationId: ctx.user.organizationId },
    });
    if (!project) return err("Projet introuvable", 404);
  }

  // Plan limit — maxInvoicesPerMonth
  const currentThisMonth = await db.invoice.count({
    where: {
      organizationId: ctx.user.organizationId,
      createdAt: { gte: startOfMonth() },
    },
  });
  const limit = await checkLimit(
    ctx.user.organizationId,
    "maxInvoicesPerMonth",
    currentThisMonth,
  );
  if (!limit.ok) {
    return err(
      `Limite du plan ${limit.plan} atteinte : ${limit.max} factures / mois. Passez à Pro pour des factures illimitées.`,
      402,
    );
  }

  const number = await nextNumber(ctx.user.organizationId, "invoice");

  const data: any = {
    organizationId: ctx.user.organizationId,
    clientId,
    projectId: projectId ?? null,
    contractId: contractId ?? null,
    number,
    type: type ?? "FINAL",
    issueDate: issueDate ? new Date(issueDate) : new Date(),
    dueDate: dueDate ? new Date(dueDate) : null,
    notes: notes ?? null,
    terms: terms ?? null,
    discount: typeof discount === "number" ? discount : 0,
    taxRate: typeof taxRate === "number" ? taxRate : 0,
    status: "DRAFT",
  };

  if (Array.isArray(items) && items.length > 0) {
    data.items = {
      create: items.map((it: any) => ({
        title: it.title,
        description: it.description ?? null,
        qty: typeof it.qty === "number" ? it.qty : 1,
        unitPrice: typeof it.unitPrice === "number" ? it.unitPrice : 0,
      })),
    };
  }

  const created = await db.invoice.create({
    data,
    include: { items: true, client: true },
  });

  // Compute totals from items if provided
  const totals = invoiceTotals({
    items: created.items,
    discount: created.discount,
    taxRate: created.taxRate,
  });

  await timeline(
    clientId,
    "INVOICE_CREATED",
    `Facture ${created.number} créée`,
    { invoiceId: created.id },
  );

  await audit(
    ctx.user.organizationId,
    ctx.user.id,
    "INVOICE_CREATED",
    created.id,
    `Facture ${created.number} créée`,
    { invoiceId: created.id, number: created.number },
  );

  return ok({ ...created, ...totals }, 201);
}
