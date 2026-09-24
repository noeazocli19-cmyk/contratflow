import { NextRequest } from "next/server";
import { ok, err, onContractSigned, audit } from "@/lib/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const contract = await db.contract.findUnique({
    where: { publicToken: token },
  });
  if (!contract) return err("Contrat introuvable", 404);

  const body = await req.json();
  const { signedBy, signedByEmail, signatureData } = body || {};
  if (!signedBy || typeof signedBy !== "string" || !signedBy.trim()) {
    return err("signedBy est requis", 400);
  }
  if (!signedByEmail || typeof signedByEmail !== "string" || !signedByEmail.trim()) {
    return err("signedByEmail est requis", 400);
  }

  // Create the signature record
  await db.signature.create({
    data: {
      contractId: contract.id,
      signedBy: signedBy.trim(),
      signedByEmail: signedByEmail.trim(),
      signatureData: signatureData ?? null,
    },
  });

  // Workflow: creates project + payment plan + deposit invoice + notifications + timeline
  const result = await onContractSigned(contract.id, signedBy);

  await audit(
    contract.organizationId,
    undefined,
    "CONTRACT_SIGNED",
    contract.id,
    `Contrat ${contract.number} signé par ${signedBy} (${signedByEmail})`,
    { contractId: contract.id, number: contract.number, signedBy, signedByEmail },
  );

  const updatedContract = await db.contract.findUnique({
    where: { id: contract.id },
  });

  return ok({
    contract: updatedContract,
    project: result?.project ?? null,
    depositInvoice: result?.depositInvoice ?? null,
  });
}
