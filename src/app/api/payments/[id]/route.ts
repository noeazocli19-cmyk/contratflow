import { NextRequest } from "next/server";
import { getCtx, ok, err, recomputeInvoiceStatus } from "@/lib/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const item = await db.payment.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
    include: { client: true, invoice: true },
  });
  if (!item) return err("Introuvable", 404);
  return ok(item);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const existing = await db.payment.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Introuvable", 404);

  const invoiceId = existing.invoiceId;
  await db.payment.delete({ where: { id } });

  // Recompute linked invoice status after deletion
  if (invoiceId) {
    await recomputeInvoiceStatus(invoiceId);
  }

  return ok({ deleted: true });
}
