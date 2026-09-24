import { NextRequest } from "next/server";
import { getCtx, ok, err, nextNumber, timeline, notify } from "@/lib/server";
import { db } from "@/lib/db";

// POST /api/proposal-templates/:id/instantiate
// Body: { clientId }
// Creates a proposal from the template + default items.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;

  const template = await db.proposalTemplate.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!template) return err("Modèle introuvable", 404);

  const body = await req.json();
  const { clientId } = body || {};
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

  // Compute amount: template.amount if provided, otherwise sum of items
  let finalAmount = template.amount ?? 0;
  if (!finalAmount && normItems.length > 0) {
    finalAmount = normItems.reduce(
      (s, it) => s + (it.qty || 0) * (it.unitPrice || 0),
      0,
    );
  }

  const number = await nextNumber(ctx.user.organizationId, "proposal");

  const created = await db.proposal.create({
    data: {
      organizationId: ctx.user.organizationId,
      clientId,
      number,
      title: template.title,
      problem: template.problem ?? null,
      solution: template.solution ?? null,
      deliverables: template.deliverables ?? null,
      timeline: template.timeline ?? null,
      amount: finalAmount,
      currency: "XOF",
      conditions: template.conditions ?? null,
      options: template.options ?? null,
      notes: template.notes ?? null,
      items: normItems.length > 0 ? { create: normItems } : undefined,
    },
    include: { items: true, client: true },
  });

  await notify(
    ctx.user.organizationId,
    "PROPOSAL_CREATED",
    "Proposition créée",
    `Proposition ${created.number} créée depuis le modèle « ${template.name} ».`,
    "proposals",
  );
  await timeline(
    client.id,
    "PROPOSAL_CREATED",
    `Proposition ${created.number} créée depuis le modèle « ${template.name} »`,
    { proposalId: created.id },
  );

  return ok(created, 201);
}
