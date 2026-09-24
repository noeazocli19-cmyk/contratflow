import { NextRequest } from "next/server";
import { getCtx, ok, err, genToken, notify, timeline, audit } from "@/lib/server";
import { db } from "@/lib/db";

// POST /api/contracts/:id/send — set status SENT, ensure publicToken, sentAt, notify
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;

  const existing = await db.contract.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
    include: { client: true },
  });
  if (!existing) return err("Contrat introuvable", 404);

  const publicToken = existing.publicToken ?? genToken();
  const now = new Date();

  await db.contract.update({
    where: { id },
    data: {
      status: "SENT",
      sentAt: now,
      publicToken,
    },
  });

  await notify(
    ctx.user.organizationId,
    "CONTRACT_SENT",
    "Contrat envoyé",
    `Le contrat ${existing.number} a été envoyé à ${existing.client?.firstName ?? ""} ${existing.client?.lastName ?? ""}`.trim(),
    "contracts",
  );
  await timeline(
    existing.clientId,
    "CONTRACT_SENT",
    `Contrat ${existing.number} envoyé`,
    { contractId: existing.id },
  );

  await audit(
    ctx.user.organizationId,
    ctx.user.id,
    "CONTRACT_SENT",
    existing.id,
    `Contrat ${existing.number} envoyé au client`,
    { contractId: existing.id, number: existing.number },
  );

  return ok({ publicToken });
}
