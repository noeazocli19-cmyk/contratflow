import { NextRequest } from "next/server";
import { getCtx, ok, err, nextNumber, timeline, notify, invoiceTotals } from "@/lib/server";
import { db } from "@/lib/db";

// POST /api/invoice-templates/:id/instantiate
// Body: { clientId, projectId?, contractId?, dueDate? }
// Creates an invoice from the template + default items.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;

  const template = await db.invoiceTemplate.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!template) return err("Modèle introuvable", 404);

  const body = await req.json();
  const { clientId, projectId, contractId, dueDate } = body || {};
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

  // Parse defaultItems JSON
  let defaultItems: any[] = [];
  if (template.defaultItems) {
    try {
      const parsed = JSON.parse(template.defaultItems);
      if (Array.isArray(parsed)) defaultItems = parsed;
    } catch {
      defaultItems = [];
    }
  }
  const normItems = defaultItems
    .filter((it: any) => it && it.title)
    .map((it: any) => ({
      title: String(it.title),
      description: it.description ?? null,
      qty: typeof it.qty === "number" ? it.qty : 1,
      unitPrice: typeof it.unitPrice === "number" ? it.unitPrice : 0,
    }));

  const number = await nextNumber(ctx.user.organizationId, "invoice");

  const created = await db.invoice.create({
    data: {
      organizationId: ctx.user.organizationId,
      clientId,
      projectId: projectId ?? null,
      contractId: contractId ?? null,
      number,
      type: template.type || "FINAL",
      issueDate: new Date(),
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: template.notes ?? null,
      terms: template.terms ?? null,
      discount: template.discount ?? 0,
      taxRate: template.taxRate ?? 0,
      status: "DRAFT",
      items: normItems.length > 0 ? { create: normItems } : undefined,
    },
    include: { items: true, client: true },
  });

  const totals = invoiceTotals({
    items: created.items,
    discount: created.discount,
    taxRate: created.taxRate,
  });

  await notify(
    ctx.user.organizationId,
    "INVOICE_CREATED",
    "Facture créée",
    `Facture ${created.number} créée depuis le modèle « ${template.name} ».`,
    "invoices",
  );
  await timeline(
    clientId,
    "INVOICE_CREATED",
    `Facture ${created.number} créée depuis le modèle « ${template.name} »`,
    { invoiceId: created.id },
  );

  return ok({ ...created, ...totals }, 201);
}
