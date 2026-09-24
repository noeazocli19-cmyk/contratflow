import { NextRequest } from "next/server";
import { ok, err } from "@/lib/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const proposal = await db.proposal.findUnique({
    where: { publicToken: token },
    include: { items: true, client: true, organization: true },
  });
  if (!proposal) return err("Proposition introuvable", 404);

  // Auto-mark VIEWED on first view (only if currently SENT)
  if (proposal.status === "SENT") {
    const updated = await db.proposal.update({
      where: { id: proposal.id },
      data: { status: "VIEWED", viewedAt: new Date() },
    });
    return ok({
      proposal: updated,
      items: proposal.items,
      client: proposal.client,
      organization: proposal.organization,
    });
  }

  return ok({
    proposal,
    items: proposal.items,
    client: proposal.client,
    organization: proposal.organization,
  });
}
