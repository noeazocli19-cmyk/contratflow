import { NextRequest } from "next/server";
import { ok, err, invoiceTotals } from "@/lib/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const quote = await db.quote.findUnique({
    where: { publicToken: token },
    include: { items: true, client: true, organization: true },
  });
  if (!quote) return err("Devis introuvable", 404);

  // Auto-mark VIEWED on first view (only if currently SENT)
  let returned = quote;
  if (quote.status === "SENT") {
    returned = await db.quote.update({
      where: { id: quote.id },
      data: { status: "VIEWED", viewedAt: new Date() },
      include: { items: true, client: true, organization: true },
    });
  }

  // Compute totals (sum qty*unitPrice, apply discount %, apply taxRate %)
  const totals = invoiceTotals({
    items: returned.items.map((it) => ({
      qty: it.qty,
      unitPrice: it.unitPrice,
    })),
    discount: returned.discount,
    taxRate: returned.taxRate,
  });

  return ok({
    quote: returned,
    items: returned.items,
    client: returned.client,
    organization: returned.organization,
    subtotal: totals.subtotal,
    discountAmount: totals.discountAmount,
    taxAmount: totals.taxAmount,
    total: totals.total,
  });
}
