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

  const quote = await db.quote.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!quote) return err("Devis introuvable", 404);

  const item = await db.quoteItem.findUnique({ where: { id: itemId } });
  if (!item || item.quoteId !== id) {
    return err("Ligne introuvable", 404);
  }

  const body = await req.json();
  const data: any = {};
  for (const k of ["title", "description", "qty", "unitPrice"]) {
    if (k in body) data[k] = body[k];
  }

  const updated = await db.quoteItem.update({ where: { id: itemId }, data });
  return ok(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id, itemId } = await params;

  const quote = await db.quote.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!quote) return err("Devis introuvable", 404);

  const item = await db.quoteItem.findUnique({ where: { id: itemId } });
  if (!item || item.quoteId !== id) {
    return err("Ligne introuvable", 404);
  }

  await db.quoteItem.delete({ where: { id: itemId } });
  return ok({ deleted: true });
}
