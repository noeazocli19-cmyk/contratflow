import { NextRequest } from "next/server";
import { getCtx, ok, err, onPaymentReceived, audit } from "@/lib/server";
import { db } from "@/lib/db";

export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const items = await db.payment.findMany({
    where: { organizationId: ctx.user.organizationId },
    include: { client: true, invoice: true },
    orderBy: { paidAt: "desc" },
  });
  return ok(items);
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const body = await req.json();
  const { clientId, invoiceId, amount, method, reference, note, paidAt } =
    body || {};

  if (!clientId) return err("clientId est requis", 400);
  if (typeof amount !== "number" || amount <= 0)
    return err("amount doit être positif", 400);

  const client = await db.client.findFirst({
    where: { id: clientId, organizationId: ctx.user.organizationId },
  });
  if (!client) return err("Client introuvable", 404);

  if (invoiceId) {
    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId, organizationId: ctx.user.organizationId },
    });
    if (!invoice) return err("Facture introuvable", 404);
  }

  const payment = await db.payment.create({
    data: {
      organizationId: ctx.user.organizationId,
      clientId,
      invoiceId: invoiceId ?? null,
      amount,
      method: method ?? "CASH",
      reference: reference ?? null,
      note: note ?? null,
      status: "CONFIRMED",
      paidAt: paidAt ? new Date(paidAt) : new Date(),
    },
    include: { client: true, invoice: true },
  });

  // Auto-update invoice status, installment, notification, timeline
  await onPaymentReceived(
    invoiceId ?? null,
    amount,
    ctx.user.organizationId,
    clientId,
  );

  await audit(
    ctx.user.organizationId,
    ctx.user.id,
    "PAYMENT_RECORDED",
    payment.id,
    `Paiement de ${amount.toLocaleString("fr-FR")} FCFA enregistré`,
    { paymentId: payment.id, invoiceId: invoiceId ?? null, amount, method: payment.method },
  );

  return ok(payment, 201);
}
