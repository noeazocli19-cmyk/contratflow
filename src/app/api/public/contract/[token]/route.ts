import { NextRequest } from "next/server";
import { ok, err } from "@/lib/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const contract = await db.contract.findUnique({
    where: { publicToken: token },
    include: { client: true, signatures: true, organization: true },
  });
  if (!contract) return err("Contrat introuvable", 404);

  // Auto-mark VIEWED on first view (only if currently SENT)
  if (contract.status === "SENT") {
    const updated = await db.contract.update({
      where: { id: contract.id },
      data: { status: "VIEWED", viewedAt: new Date() },
    });
    return ok({
      contract: updated,
      client: contract.client,
      signatures: contract.signatures,
      organization: contract.organization,
    });
  }

  return ok({
    contract,
    client: contract.client,
    signatures: contract.signatures,
    organization: contract.organization,
  });
}
