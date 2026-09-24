import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const invoice = await db.invoice.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!invoice) return err("Facture introuvable", 404);

  const body = await req.json();
  const { title, description, qty, unitPrice } = body || {};
  if (!title) return err("title est requis", 400);

  const item = await db.invoiceItem.create({
    data: {
      invoiceId: id,
      title,
      description: description ?? null,
      qty: typeof qty === "number" ? qty : 1,
      unitPrice: typeof unitPrice === "number" ? unitPrice : 0,
    },
  });
  return ok(item, 201);
}
