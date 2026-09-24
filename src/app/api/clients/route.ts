import { NextRequest } from "next/server";
import { getCtx, ok, err, genToken, audit } from "@/lib/server";
import { db } from "@/lib/db";
import { checkLimit } from "@/lib/plans";

// GET /api/clients — list with per-client stats (counts + total paid)
export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const clients = await db.client.findMany({
    where: { organizationId: ctx.user.organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          contracts: true,
          projects: true,
          invoices: true,
        },
      },
      payments: { where: { status: "CONFIRMED" } },
    },
  });

  const result = clients.map((c) => ({
    ...c,
    contractsCount: c._count.contracts,
    projectsCount: c._count.projects,
    invoicesCount: c._count.invoices,
    totalPaid: c.payments.reduce((s, p) => s + p.amount, 0),
  }));

  return ok(
    result.map(({ _count, payments, ...rest }) => rest),
  );
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const body = await req.json();
  if (!body?.firstName) return err("firstName est requis", 400);

  // Plan limit — maxClients
  const current = await db.client.count({
    where: { organizationId: ctx.user.organizationId },
  });
  const limit = await checkLimit(ctx.user.organizationId, "maxClients", current);
  if (!limit.ok) {
    return err(
      `Limite du plan ${limit.plan} atteinte : ${limit.max} clients maximum. Passez à Pro pour des clients illimités.`,
      402,
    );
  }

  const created = await db.client.create({
    data: {
      organizationId: ctx.user.organizationId,
      firstName: body.firstName,
      lastName: body.lastName ?? "",
      company: body.company ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      address: body.address ?? null,
      country: body.country ?? null,
      taxId: body.taxId ?? null,
      notes: body.notes ?? null,
      portalToken: genToken(),
    },
  });

  await audit(
    ctx.user.organizationId,
    ctx.user.id,
    "CLIENT_CREATED",
    created.id,
    `Client « ${created.firstName} ${created.lastName} » créé`,
    { clientId: created.id, number: created.id },
  );

  return ok(created, 201);
}
