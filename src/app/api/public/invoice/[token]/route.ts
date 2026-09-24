import { NextRequest } from "next/server";
import { ok, err, invoiceTotals } from "@/lib/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const invoice = await db.invoice.findUnique({
    where: { publicToken: token },
    include: {
      items: true,
      payments: true,
      client: true,
      organization: true,
    },
  });
  if (!invoice) return err("Facture introuvable", 404);

  // Auto-mark VIEWED on first view (only if currently SENT)
  let returned = invoice;
  if (invoice.status === "SENT") {
    returned = await db.invoice.update({
      where: { id: invoice.id },
      data: { status: "VIEWED", viewedAt: new Date() },
      include: {
        items: true,
        payments: true,
        client: true,
        organization: true,
      },
    });
  }

  const totals = invoiceTotals(returned);
  const paidAmount = returned.payments
    .filter((p) => p.status === "CONFIRMED")
    .reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, totals.total - paidAmount);

  return ok({
    invoice: returned,
    items: returned.items,
    payments: returned.payments,
    client: returned.client,
    organization: returned.organization,
    subtotal: totals.subtotal,
    discountAmount: totals.discountAmount,
    taxAmount: totals.taxAmount,
    total: totals.total,
    paidAmount,
    balance,
  });
}
