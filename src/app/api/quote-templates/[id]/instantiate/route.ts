import { NextRequest } from "next/server";
import { getCtx, ok, err, nextNumber, timeline, notify } from "@/lib/server";
import { db } from "@/lib/db";

// POST /api/quote-templates/:id/instantiate
// Body: { clientId, expirationDate? }
// Creates a quote from the template + default items.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;

  const template = await db.quoteTemplate.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!template) return err("Modèle introuvable", 404);

  const body = await req.json();
  const { clientId, expirationDate } = body || {};
  if (!clientId) return err("clientId est requis", 400);

  const client = await db.client.findFirst({
    where: { id: clientId, organizationId: ctx.user.organizationId },
  });
  if (!client) return err("Client introuvable", 404);

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

  const number = await nextNumber(ctx.user.organizationId, "quote");

  const created = await db.quote.create({
    data: {
      organizationId: ctx.user.organizationId,
      clientId,
      number,
      expirationDate: expirationDate ? new Date(expirationDate) : null,
      notes: template.notes ?? null,
      terms: template.terms ?? null,
      discount: template.discount ?? 0,
      taxRate: template.taxRate ?? 0,
      items: normItems.length > 0 ? { create: normItems } : undefined,
    },
    include: { items: true, client: true },
  });

  await notify(
    ctx.user.organizationId,
    "QUOTE_CREATED",
    "Devis créé",
    `Devis ${created.number} créé depuis le modèle « ${template.name} ».`,
    "quotes",
  );
  await timeline(
    client.id,
    "QUOTE_CREATED",
    `Devis ${created.number} créé depuis le modèle « ${template.name} »`,
  );

  return ok(created, 201);
}
