import { NextRequest } from "next/server";
import {
  getCtx,
  ok,
  err,
  invoiceTotals,
} from "@/lib/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const invoice = await db.invoice.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
    include: { items: true, payments: true, client: true },
  });
  if (!invoice) return err("Introuvable", 404);

  const totals = invoiceTotals(invoice);
  const paidAmount = invoice.payments
    .filter((p) => p.status === "CONFIRMED")
    .reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, totals.total - paidAmount);

  return ok({ ...invoice, ...totals, paidAmount, balance });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const existing = await db.invoice.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Introuvable", 404);

  const body = await req.json();
  const allowed: Record<string, unknown> = {};
  for (const key of [
    "type",
    "issueDate",
    "dueDate",
    "notes",
    "terms",
    "discount",
    "taxRate",
    "status",
  ]) {
    if (key in body) {
      const v = body[key];
      if (key === "issueDate" || key === "dueDate") {
        allowed[key] = v ? new Date(v) : null;
      } else if (key === "discount" || key === "taxRate") {
        allowed[key] = typeof v === "number" ? v : 0;
      } else {
        allowed[key] = v;
      }
    }
  }

  const updated = await db.invoice.update({
    where: { id },
    data: allowed,
    include: { items: true, payments: true, client: true },
  });

  const totals = invoiceTotals(updated);
  const paidAmount = updated.payments
    .filter((p) => p.status === "CONFIRMED")
    .reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, totals.total - paidAmount);

  return ok({ ...updated, ...totals, paidAmount, balance });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const existing = await db.invoice.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Introuvable", 404);
  await db.invoice.delete({ where: { id } });
  return ok({ deleted: true });
}
