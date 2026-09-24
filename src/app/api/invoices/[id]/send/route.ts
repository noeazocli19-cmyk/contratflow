import { NextRequest } from "next/server";
import { getCtx, ok, err, genToken, timeline, audit } from "@/lib/server";
import { db } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const invoice = await db.invoice.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!invoice) return err("Introuvable", 404);

  const publicToken = invoice.publicToken ?? genToken();
  const updated = await db.invoice.update({
    where: { id },
    data: {
      status: "SENT",
      sentAt: new Date(),
      publicToken,
    },
  });

  await timeline(
    invoice.clientId,
    "INVOICE_SENT",
    `Facture ${invoice.number} envoyée`,
    { invoiceId: id },
  );

  await audit(
    ctx.user.organizationId,
    ctx.user.id,
    "INVOICE_SENT",
    invoice.id,
    `Facture ${invoice.number} envoyée au client`,
    { invoiceId: invoice.id, number: invoice.number },
  );

  return ok({ publicToken: updated.publicToken });
}
