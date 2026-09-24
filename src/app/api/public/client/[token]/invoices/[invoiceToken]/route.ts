import { NextRequest } from "next/server";
import { ok, err, invoiceTotals } from "@/lib/server";
import { db } from "@/lib/db";

// GET /api/public/client/:token/invoices/:invoiceToken
// Look up invoice by publicToken AND clientId derived from the client portal token.
// Returns the same shape as /api/public/invoice/[token]/route.ts
export async function GET(
  _req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ token: string; invoiceToken: string }>;
  },
) {
  const { token, invoiceToken } = await params;

  const client = await db.client.findUnique({
    where: { portalToken: token },
    include: { organization: true },
  });
  if (!client) return err("Portail client introuvable", 404);

  const invoice = await db.invoice.findFirst({
    where: { publicToken: invoiceToken, clientId: client.id },
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
