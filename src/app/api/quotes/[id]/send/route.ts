import { NextRequest } from "next/server";
import { getCtx, ok, err, genToken, notify, timeline } from "@/lib/server";
import { db } from "@/lib/db";

// POST /api/quotes/:id/send — set status SENT, ensure publicToken, sentAt
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;

  const existing = await db.quote.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
    include: { client: true },
  });
  if (!existing) return err("Devis introuvable", 404);

  const publicToken = existing.publicToken ?? genToken();
  const now = new Date();

  await db.quote.update({
    where: { id },
    data: {
      status: "SENT",
      sentAt: now,
      publicToken,
    },
  });

  await notify(
    ctx.user.organizationId,
    "QUOTE_SENT",
    "Devis envoyé",
    `Le devis ${existing.number} a été envoyé à ${existing.client?.firstName ?? ""} ${existing.client?.lastName ?? ""}`.trim(),
    "quotes",
  );
  await timeline(
    existing.clientId,
    "QUOTE_SENT",
    `Devis ${existing.number} envoyé`,
  );

  return ok({ publicToken });
}
