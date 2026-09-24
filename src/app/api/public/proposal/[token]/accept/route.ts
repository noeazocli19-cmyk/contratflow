import { NextRequest } from "next/server";
import { ok, err, notify, timeline } from "@/lib/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const proposal = await db.proposal.findUnique({
    where: { publicToken: token },
  });
  if (!proposal) return err("Proposition introuvable", 404);

  const body = await req.json();
  const { decision, message } = body || {};
  if (!decision || !["ACCEPT", "REFUSE"].includes(decision)) {
    return err("decision doit être 'ACCEPT' ou 'REFUSE'", 400);
  }

  if (decision === "ACCEPT") {
    const updated = await db.proposal.update({
      where: { id: proposal.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
    });

    await notify(
      proposal.organizationId,
      "PROPOSAL_ACCEPTED",
      "Proposition acceptée",
      `Le client a accepté la proposition ${proposal.number}${message ? " : " + message : ""}.`,
      "proposals",
    );
    await timeline(
      proposal.clientId,
      "PROPOSAL_ACCEPTED",
      `Proposition ${proposal.number} acceptée`,
      { proposalId: proposal.id },
    );

    return ok({ proposal: updated });
  } else {
    const updated = await db.proposal.update({
      where: { id: proposal.id },
      data: {
        status: "REFUSED",
        refusedAt: new Date(),
      },
    });

    await notify(
      proposal.organizationId,
      "PROPOSAL_REFUSED",
      "Proposition refusée",
      `Le client a refusé la proposition ${proposal.number}${message ? " : " + message : ""}.`,
      "proposals",
    );
    await timeline(
      proposal.clientId,
      "PROPOSAL_REFUSED",
      `Proposition ${proposal.number} refusée`,
      { proposalId: proposal.id },
    );

    return ok({ proposal: updated });
  }
}
