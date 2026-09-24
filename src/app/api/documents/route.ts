import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId") || undefined;
  const projectId = url.searchParams.get("projectId") || undefined;
  const contractId = url.searchParams.get("contractId") || undefined;
  const invoiceId = url.searchParams.get("invoiceId") || undefined;
  const proposalId = url.searchParams.get("proposalId") || undefined;

  const items = await db.document.findMany({
    where: {
      organizationId: ctx.user.organizationId,
      ...(clientId ? { clientId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(contractId ? { contractId } : {}),
      ...(invoiceId ? { invoiceId } : {}),
      ...(proposalId ? { proposalId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return ok(items);
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const body = await req.json();
  const {
    name,
    type,
    url,
    clientId,
    projectId,
    contractId,
    invoiceId,
    proposalId,
    mime,
    size,
  } = body || {};

  if (!name) return err("name est requis", 400);
  if (!type) return err("type est requis", 400);

  const allowedTypes = [
    "PROPOSAL",
    "QUOTE",
    "CONTRACT",
    "INVOICE",
    "RECEIPT",
    "FILE",
  ];
  if (!allowedTypes.includes(type)) return err("type invalide", 400);

  // Verify tenancy for provided associations
  if (clientId) {
    const c = await db.client.findFirst({
      where: { id: clientId, organizationId: ctx.user.organizationId },
    });
    if (!c) return err("Client introuvable", 404);
  }
  if (projectId) {
    const p = await db.project.findFirst({
      where: { id: projectId, organizationId: ctx.user.organizationId },
    });
    if (!p) return err("Projet introuvable", 404);
  }
  if (contractId) {
    const c = await db.contract.findFirst({
      where: { id: contractId, organizationId: ctx.user.organizationId },
    });
    if (!c) return err("Contrat introuvable", 404);
  }
  if (invoiceId) {
    const i = await db.invoice.findFirst({
      where: { id: invoiceId, organizationId: ctx.user.organizationId },
    });
    if (!i) return err("Facture introuvable", 404);
  }
  if (proposalId) {
    const p = await db.proposal.findFirst({
      where: { id: proposalId, organizationId: ctx.user.organizationId },
    });
    if (!p) return err("Proposition introuvable", 404);
  }

  const created = await db.document.create({
    data: {
      organizationId: ctx.user.organizationId,
      name,
      type,
      url: url ?? null,
      clientId: clientId ?? null,
      projectId: projectId ?? null,
      contractId: contractId ?? null,
      invoiceId: invoiceId ?? null,
      proposalId: proposalId ?? null,
      mime: mime ?? null,
      size: typeof size === "number" ? size : 0,
    },
  });
  return ok(created, 201);
}
