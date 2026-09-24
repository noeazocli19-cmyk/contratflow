import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

// POST /api/quotes/:id/items — add an item
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;

  const existing = await db.quote.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Devis introuvable", 404);

  const body = await req.json();
  if (!body?.title) return err("Le titre est requis", 400);

  const created = await db.quoteItem.create({
    data: {
      quoteId: id,
      title: body.title,
      description: body.description ?? null,
      qty: typeof body.qty === "number" ? body.qty : 1,
      unitPrice: typeof body.unitPrice === "number" ? body.unitPrice : 0,
    },
  });

  return ok(created, 201);
}
