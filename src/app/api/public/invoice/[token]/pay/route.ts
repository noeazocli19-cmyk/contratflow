import { NextRequest } from "next/server";
import { ok, err, invoiceTotals, onPaymentReceived } from "@/lib/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const invoice = await db.invoice.findUnique({
    where: { publicToken: token },
    include: { items: true, payments: true, client: true, organization: true },
  });
  if (!invoice) return err("Facture introuvable", 404);

  const body = await req.json();
  const { method, reference } = body || {};
  if (!method) return err("method est requis", 400);

  // Compute balance to default amount
  const totals = invoiceTotals(invoice);
  const paidAmount = invoice.payments
    .filter((p) => p.status === "CONFIRMED")
    .reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, totals.total - paidAmount);

  let amount = typeof body.amount === "number" ? body.amount : balance;
  if (amount <= 0) return err("Montant invalide (facture déjà payée?)", 400);

  const payment = await db.payment.create({
    data: {
      organizationId: invoice.organizationId,
      clientId: invoice.clientId,
      invoiceId: invoice.id,
      amount,
      method,
      reference: reference ?? null,
      status: "CONFIRMED",
      paidAt: new Date(),
    },
    include: { client: true, invoice: true },
  });

  // Auto-update invoice status, installment, notification, timeline
  await onPaymentReceived(
    invoice.id,
    amount,
    invoice.organizationId,
    invoice.clientId,
  );

  const refreshedInvoice = await db.invoice.findUnique({
    where: { id: invoice.id },
    include: { items: true, payments: true, client: true },
  });

  return ok({ payment, invoice: refreshedInvoice });
}
