import { NextRequest } from "next/server";
import { getCtx, ok, err, nextNumber, audit } from "@/lib/server";
import { db } from "@/lib/db";
import { checkLimit, startOfMonth } from "@/lib/plans";

export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const items = await db.proposal.findMany({
    where: { organizationId: ctx.user.organizationId },
    include: { items: true, client: true },
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
    title,
    problem,
    solution,
    deliverables,
    timeline: timelineText,
    amount,
    currency,
    conditions,
    options,
    validUntil,
    notes,
    items,
  } = body || {};

  if (!clientId || !title) {
    return err("clientId et title sont requis", 400);
  }

  // Verify client belongs to tenant
  const client = await db.client.findFirst({
    where: { id: clientId, organizationId: ctx.user.organizationId },
  });
  if (!client) return err("Client introuvable", 404);

  // Plan limit — maxProposalsPerMonth
  const monthStart = startOfMonth();
  const currentThisMonth = await db.proposal.count({
    where: {
      organizationId: ctx.user.organizationId,
      createdAt: { gte: monthStart },
    },
  });
  const limit = await checkLimit(
    ctx.user.organizationId,
    "maxProposalsPerMonth",
    currentThisMonth,
  );
  if (!limit.ok) {
    return err(
      `Limite du plan ${limit.plan} atteinte : ${limit.max} propositions / mois. Passez à Pro pour des propositions illimitées.`,
      402,
    );
  }

  // Normalize items array
  const normItems = Array.isArray(items)
    ? items
        .filter((it: any) => it && it.title)
        .map((it: any) => ({
          title: String(it.title),
          description: it.description ?? null,
          qty: typeof it.qty === "number" ? it.qty : 1,
          unitPrice: typeof it.unitPrice === "number" ? it.unitPrice : 0,
        }))
    : [];

  // Compute amount if not provided and items provided
  let finalAmount = typeof amount === "number" ? amount : 0;
  if (typeof amount !== "number" && normItems.length > 0) {
    finalAmount = normItems.reduce(
      (s: number, it: any) => s + (it.qty || 0) * (it.unitPrice || 0),
      0,
    );
  }

  const number = await nextNumber(ctx.user.organizationId, "proposal");

  const created = await db.proposal.create({
    data: {
      organizationId: ctx.user.organizationId,
      clientId,
      number,
      title,
      problem: problem ?? null,
      solution: solution ?? null,
      deliverables: deliverables ?? null,
      timeline: timelineText ?? null,
      amount: finalAmount,
      currency: currency ?? "XOF",
      conditions: conditions ?? null,
      options: options ?? null,
      validUntil: validUntil ? new Date(validUntil) : null,
      notes: notes ?? null,
      items:
        normItems.length > 0
          ? { create: normItems as any }
          : undefined,
    },
    include: { items: true, client: true },
  });

  await audit(
    ctx.user.organizationId,
    ctx.user.id,
    "PROPOSAL_CREATED",
    created.id,
    `Proposition ${created.number} « ${created.title} » créée`,
    { proposalId: created.id, number: created.number },
  );

  return ok(created, 201);
}
