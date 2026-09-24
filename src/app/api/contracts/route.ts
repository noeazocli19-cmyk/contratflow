import { NextRequest } from "next/server";
import { getCtx, ok, err, nextNumber, audit } from "@/lib/server";
import { db } from "@/lib/db";
import { checkLimit } from "@/lib/plans";
import { formatCurrency, formatDate } from "@/lib/format";

function resolveVariables(
  content: string,
  ctx: { client: { firstName: string; lastName: string; company: string | null }; title: string; amount: number; currency: string; startDate: string | null; endDate: string | null; duration: string | null },
): string {
  const clientName = `${ctx.client.firstName} ${ctx.client.lastName}`.trim();
  const replacements: Record<string, string> = {
    "{{client_name}}": clientName,
    "{{company_name}}": ctx.client.company || clientName,
    "{{project_name}}": ctx.title,
    "{{amount}}": formatCurrency(ctx.amount, ctx.currency),
    "{{start_date}}": ctx.startDate ? formatDate(ctx.startDate) : "—",
    "{{end_date}}": ctx.endDate ? formatDate(ctx.endDate) : "—",
    "{{duration}}": ctx.duration || "—",
  };
  let out = content;
  for (const [k, v] of Object.entries(replacements)) {
    out = out.split(k).join(v);
  }
  return out;
}

export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const items = await db.contract.findMany({
    where: { organizationId: ctx.user.organizationId },
    include: { client: true },
    orderBy: { createdAt: "desc" },
  });
  return ok(items);
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const body = await req.json();
  const {
    clientId,
    proposalId,
    title,
    content,
    amount,
    currency,
    startDate,
    endDate,
    duration,
    conditions,
  } = body || {};

  if (!clientId || !title || !content) {
    return err("clientId, title et content sont requis", 400);
  }

  // Verify client belongs to tenant
  const client = await db.client.findFirst({
    where: { id: clientId, organizationId: ctx.user.organizationId },
  });
  if (!client) return err("Client introuvable", 404);

  // Plan limit — maxContracts
  const current = await db.contract.count({
    where: { organizationId: ctx.user.organizationId },
  });
  const limit = await checkLimit(ctx.user.organizationId, "maxContracts", current);
  if (!limit.ok) {
    return err(
      `Limite du plan ${limit.plan} atteinte : ${limit.max} contrats maximum. Passez à Pro pour des contrats illimités.`,
      402,
    );
  }

  // Verify proposal belongs to tenant if provided
  if (proposalId) {
    const proposal = await db.proposal.findFirst({
      where: { id: proposalId, organizationId: ctx.user.organizationId },
    });
    if (!proposal) return err("Proposition introuvable", 404);
  }

  const number = await nextNumber(ctx.user.organizationId, "contract");

  // Auto-resolve {{variables}} if any are present
  const resolvedContent = content.includes("{{")
    ? resolveVariables(content, {
        client,
        title,
        amount: typeof amount === "number" ? amount : 0,
        currency: currency ?? "XOF",
        startDate: startDate ?? null,
        endDate: endDate ?? null,
        duration: duration ?? null,
      })
    : content;

  const created = await db.contract.create({
    data: {
      organizationId: ctx.user.organizationId,
      clientId,
      proposalId: proposalId ?? null,
      number,
      title,
      content: resolvedContent,
      amount: typeof amount === "number" ? amount : 0,
      currency: currency ?? "XOF",
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      duration: duration ?? null,
      conditions: conditions ?? null,
    },
    include: { client: true },
  });

  await audit(
    ctx.user.organizationId,
    ctx.user.id,
    "CONTRACT_CREATED",
    created.id,
    `Contrat ${created.number} « ${created.title} » créé`,
    { contractId: created.id, number: created.number },
  );

  return ok(created, 201);
}
