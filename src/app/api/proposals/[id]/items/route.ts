import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

// POST /api/proposals/:id/items — add an item
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;

  const existing = await db.proposal.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Proposition introuvable", 404);

  const body = await req.json();
  if (!body?.title) return err("Le titre est requis", 400);

  const created = await db.proposalItem.create({
    data: {
      proposalId: id,
      title: body.title,
      description: body.description ?? null,
      qty: typeof body.qty === "number" ? body.qty : 1,
      unitPrice: typeof body.unitPrice === "number" ? body.unitPrice : 0,
    },
  });

  // Recompute proposal amount from items
  const allItems = await db.proposalItem.findMany({ where: { proposalId: id } });
  const total = allItems.reduce((s, it) => s + (it.qty || 0) * (it.unitPrice || 0), 0);
  await db.proposal.update({ where: { id }, data: { amount: total } });

  return ok(created, 201);
}
