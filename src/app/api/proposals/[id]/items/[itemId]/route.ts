import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id, itemId } = await params;

  const proposal = await db.proposal.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!proposal) return err("Proposition introuvable", 404);

  const item = await db.proposalItem.findUnique({ where: { id: itemId } });
  if (!item || item.proposalId !== id) {
    return err("Ligne introuvable", 404);
  }

  const body = await req.json();
  const data: any = {};
  for (const k of ["title", "description", "qty", "unitPrice"]) {
    if (k in body) data[k] = body[k];
  }

  const updated = await db.proposalItem.update({ where: { id: itemId }, data });

  // Recompute proposal amount
  const allItems = await db.proposalItem.findMany({ where: { proposalId: id } });
  const total = allItems.reduce((s, it) => s + (it.qty || 0) * (it.unitPrice || 0), 0);
  await db.proposal.update({ where: { id }, data: { amount: total } });

  return ok(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id, itemId } = await params;

  const proposal = await db.proposal.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!proposal) return err("Proposition introuvable", 404);

  const item = await db.proposalItem.findUnique({ where: { id: itemId } });
  if (!item || item.proposalId !== id) {
    return err("Ligne introuvable", 404);
  }

  await db.proposalItem.delete({ where: { id: itemId } });

  // Recompute proposal amount
  const allItems = await db.proposalItem.findMany({ where: { proposalId: id } });
  const total = allItems.reduce((s, it) => s + (it.qty || 0) * (it.unitPrice || 0), 0);
  await db.proposal.update({ where: { id }, data: { amount: total } });

  return ok({ deleted: true });
}
