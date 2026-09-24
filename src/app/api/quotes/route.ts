import { NextRequest } from "next/server";
import { getCtx, ok, err, nextNumber } from "@/lib/server";
import { db } from "@/lib/db";

export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const items = await db.quote.findMany({
    where: { organizationId: ctx.user.organizationId },
    include: { items: true, client: true },
    orderBy: { createdAt: "desc" },
  });
  return ok(items);
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const body = await req.json();
  const {
    clientId,
    notes,
    terms,
    discount,
    taxRate,
    expirationDate,
    items,
  } = body || {};

  if (!clientId) return err("clientId est requis", 400);

  // Verify client belongs to tenant
  const client = await db.client.findFirst({
    where: { id: clientId, organizationId: ctx.user.organizationId },
  });
  if (!client) return err("Client introuvable", 404);

  // Normalize items array
  const normItems = Array.isArray(items)
    ? items
        .filter((it: any) => it && it.title)
        .map((it: any) => ({
          title: String(it.title),
          description: it.description ?? null,
          qty: typeof it.qty === "number" ? it.qty : 1,
          unitPrice: typeof it.unitPrice === "number" ? it.unitPrice : 0,
        }))
    : [];

  const number = await nextNumber(ctx.user.organizationId, "quote");

  const created = await db.quote.create({
    data: {
      organizationId: ctx.user.organizationId,
      clientId,
      number,
      notes: notes ?? null,
      terms: terms ?? null,
      discount: typeof discount === "number" ? Math.min(100, Math.max(0, discount)) : 0,
      taxRate: typeof taxRate === "number" ? Math.min(100, Math.max(0, taxRate)) : 0,
      expirationDate: expirationDate ? new Date(expirationDate) : null,
      items:
        normItems.length > 0
          ? { create: normItems as any }
          : undefined,
    },
    include: { items: true, client: true },
  });

  return ok(created, 201);
}
