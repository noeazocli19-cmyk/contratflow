import { NextRequest } from "next/server";
import { getCtx, ok, err, audit } from "@/lib/server";
import { db } from "@/lib/db";
import { getPlanLimits, startOfMonth, type PlanKey } from "@/lib/plans";

// GET /api/subscription — current subscription, plan limits + current usage counts.
export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  const orgId = ctx.user.organizationId;

  const [subscription, limits, clientsCount, contractsCount, projectsActive, membersCount] =
    await Promise.all([
      db.subscription.findUnique({ where: { organizationId: orgId } }),
      getPlanLimits(orgId),
      db.client.count({ where: { organizationId: orgId } }),
      db.contract.count({ where: { organizationId: orgId } }),
      db.project.count({
        where: {
          organizationId: orgId,
          status: { in: ["TODO", "IN_PROGRESS"] },
        },
      }),
      db.user.count({ where: { organizationId: orgId } }),
    ]);

  const monthStart = startOfMonth();
  const [proposalsThisMonth, invoicesThisMonth] = await Promise.all([
    db.proposal.count({
      where: { organizationId: orgId, createdAt: { gte: monthStart } },
    }),
    db.invoice.count({
      where: { organizationId: orgId, createdAt: { gte: monthStart } },
    }),
  ]);

  const usage = {
    clients: clientsCount,
    contracts: contractsCount,
    activeProjects: projectsActive,
    members: membersCount,
    proposalsThisMonth,
    invoicesThisMonth,
  };

  // Stringify Infinity-friendly so the client can detect "unlimited" plans.
  const limitsPayload = {
    name: limits.name,
    maxClients: limits.maxClients === Infinity ? null : limits.maxClients,
    maxProposalsPerMonth:
      limits.maxProposalsPerMonth === Infinity ? null : limits.maxProposalsPerMonth,
    maxContracts: limits.maxContracts === Infinity ? null : limits.maxContracts,
    maxActiveProjects:
      limits.maxActiveProjects === Infinity ? null : limits.maxActiveProjects,
    maxInvoicesPerMonth:
      limits.maxInvoicesPerMonth === Infinity ? null : limits.maxInvoicesPerMonth,
    maxMembers: limits.maxMembers === Infinity ? null : limits.maxMembers,
    storageMb: limits.storageMb,
    automations: limits.automations,
    templates: limits.templates,
    pdfExport: limits.pdfExport,
    reminders: limits.reminders,
    customBranding: limits.customBranding,
  };

  return ok({
    subscription: subscription
      ? {
          id: subscription.id,
          plan: subscription.plan,
          status: subscription.status,
          seats: subscription.seats,
          startedAt: subscription.startedAt,
          renewsAt: subscription.renewsAt,
        }
      : null,
    limits: limitsPayload,
    usage,
  });
}

// PATCH /api/subscription — change the active plan (MVP — no payment).
// Body: { plan: "FREE" | "PRO" | "AGENCY" }
export async function PATCH(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Requête invalide", 400);

  const { plan } = body as { plan?: string };
  const valid: PlanKey[] = ["FREE", "PRO", "AGENCY"];
  if (!plan || !valid.includes(plan as PlanKey)) {
    return err("Plan invalide (FREE | PRO | AGENCY)", 400);
  }
  const newPlan = plan as PlanKey;

  const orgId = ctx.user.organizationId;
  const existing = await db.subscription.findUnique({
    where: { organizationId: orgId },
  });

  let subscription;
  if (existing) {
    subscription = await db.subscription.update({
      where: { organizationId: orgId },
      data: {
        plan: newPlan,
        status: "ACTIVE",
        // Agency gets 5 seats; Pro & Free default to 1.
        seats: newPlan === "AGENCY" ? 5 : 1,
        renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  } else {
    subscription = await db.subscription.create({
      data: {
        organizationId: orgId,
        plan: newPlan,
        status: "ACTIVE",
        seats: newPlan === "AGENCY" ? 5 : 1,
        renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  await audit(
    orgId,
    ctx.user.id,
    "PLAN_CHANGED",
    subscription.id,
    `Plan mis à jour vers ${newPlan}`,
    { plan: newPlan, previousPlan: existing?.plan ?? null },
  );

  const limits = await getPlanLimits(orgId);
  const limitsPayload = {
    name: limits.name,
    maxClients: limits.maxClients === Infinity ? null : limits.maxClients,
    maxProposalsPerMonth:
      limits.maxProposalsPerMonth === Infinity ? null : limits.maxProposalsPerMonth,
    maxContracts: limits.maxContracts === Infinity ? null : limits.maxContracts,
    maxActiveProjects:
      limits.maxActiveProjects === Infinity ? null : limits.maxActiveProjects,
    maxInvoicesPerMonth:
      limits.maxInvoicesPerMonth === Infinity ? null : limits.maxInvoicesPerMonth,
    maxMembers: limits.maxMembers === Infinity ? null : limits.maxMembers,
    storageMb: limits.storageMb,
    automations: limits.automations,
    templates: limits.templates,
    pdfExport: limits.pdfExport,
    reminders: limits.reminders,
    customBranding: limits.customBranding,
  };

  return ok({
    subscription: {
      id: subscription.id,
      plan: subscription.plan,
      status: subscription.status,
      seats: subscription.seats,
      startedAt: subscription.startedAt,
      renewsAt: subscription.renewsAt,
    },
    limits: limitsPayload,
  });
}
