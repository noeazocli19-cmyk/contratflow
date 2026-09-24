import { NextRequest } from "next/server";
import { getCtx, ok, err, timeline, audit } from "@/lib/server";
import { db } from "@/lib/db";
import { checkLimit } from "@/lib/plans";

export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const items = await db.project.findMany({
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
  const { clientId, contractId, name, description, budget, startDate, endDate } =
    body || {};
  if (!clientId || !name) return err("clientId et name sont requis", 400);

  // Verify client belongs to tenant
  const client = await db.client.findFirst({
    where: { id: clientId, organizationId: ctx.user.organizationId },
  });
  if (!client) return err("Client introuvable", 404);

  // Verify contract belongs to tenant if provided
  if (contractId) {
    const contract = await db.contract.findFirst({
      where: { id: contractId, organizationId: ctx.user.organizationId },
    });
    if (!contract) return err("Contrat introuvable", 404);
  }

  // Plan limit — maxActiveProjects
  const current = await db.project.count({
    where: {
      organizationId: ctx.user.organizationId,
      status: { in: ["TODO", "IN_PROGRESS"] },
    },
  });
  const limit = await checkLimit(
    ctx.user.organizationId,
    "maxActiveProjects",
    current,
  );
  if (!limit.ok) {
    return err(
      `Limite du plan ${limit.plan} atteinte : ${limit.max} projets actifs maximum. Passez à Pro pour des projets illimités.`,
      402,
    );
  }

  const created = await db.project.create({
    data: {
      organizationId: ctx.user.organizationId,
      clientId,
      contractId: contractId ?? null,
      name,
      description: description ?? null,
      budget: typeof budget === "number" ? budget : 0,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    },
    include: { client: true },
  });

  await timeline(
    clientId,
    "PROJECT_CREATED",
    `Projet « ${name} » créé`,
    { projectId: created.id },
  );

  await audit(
    ctx.user.organizationId,
    ctx.user.id,
    "PROJECT_CREATED",
    created.id,
    `Projet « ${name} » créé`,
    { projectId: created.id, name },
  );

  return ok(created, 201);
}
