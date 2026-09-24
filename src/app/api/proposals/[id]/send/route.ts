import { NextRequest } from "next/server";
import { getCtx, ok, err, genToken, notify, timeline } from "@/lib/server";
import { db } from "@/lib/db";

// POST /api/proposals/:id/send — set status SENT, ensure publicToken, sentAt, notify
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;

  const existing = await db.proposal.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
    include: { client: true },
  });
  if (!existing) return err("Proposition introuvable", 404);

  const publicToken = existing.publicToken ?? genToken();
  const now = new Date();

  const updated = await db.proposal.update({
    where: { id },
    data: {
      status: "SENT",
      sentAt: now,
      publicToken,
      viewedAt: null,
    },
  });

  await notify(
    ctx.user.organizationId,
    "PROPOSAL_SENT",
    "Proposition envoyée",
    `La proposition ${existing.number} a été envoyée à ${existing.client?.firstName ?? ""} ${existing.client?.lastName ?? ""}`.trim(),
    "proposals",
  );
  await timeline(
    existing.clientId,
    "PROPOSAL_SENT",
    `Proposition ${existing.number} envoyée`,
    { proposalId: existing.id },
  );

  return ok({ publicToken });
}
