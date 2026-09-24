import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const item = await db.quote.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
    include: { items: true, client: true },
  });
  if (!item) return err("Devis introuvable", 404);
  return ok(item);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const body = await req.json();
  const existing = await db.quote.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Devis introuvable", 404);

  const data: any = {};
  for (const k of ["notes", "terms", "discount", "taxRate", "status"]) {
    if (k in body) {
      if (k === "discount" || k === "taxRate") {
        const v = typeof body[k] === "number" ? body[k] : 0;
        data[k] = Math.min(100, Math.max(0, v));
      } else {
        data[k] = body[k];
      }
    }
  }
  if ("expirationDate" in body) {
    data.expirationDate = body.expirationDate ? new Date(body.expirationDate) : null;
  }

  const updated = await db.quote.update({
    where: { id },
    data,
    include: { items: true, client: true },
  });
  return ok(updated);
}
