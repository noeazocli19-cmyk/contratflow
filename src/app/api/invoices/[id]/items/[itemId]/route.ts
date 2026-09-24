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

  const item = await db.invoiceItem.findFirst({
    where: {
      id: itemId,
      invoice: { id, organizationId: ctx.user.organizationId },
    },
  });
  if (!item) return err("Ligne introuvable", 404);

  const body = await req.json();
  const allowed: Record<string, unknown> = {};
  for (const key of ["title", "description", "qty", "unitPrice"]) {
    if (key in body) allowed[key] = body[key];
  }

  const updated = await db.invoiceItem.update({
    where: { id: itemId },
    data: allowed,
  });
  return ok(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id, itemId } = await params;
  const item = await db.invoiceItem.findFirst({
    where: {
      id: itemId,
      invoice: { id, organizationId: ctx.user.organizationId },
    },
  });
  if (!item) return err("Ligne introuvable", 404);
  await db.invoiceItem.delete({ where: { id: itemId } });
  return ok({ deleted: true });
}
