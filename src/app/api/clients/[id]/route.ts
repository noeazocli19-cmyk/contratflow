import { NextRequest } from "next/server";
import { getCtx, ok, err, audit, assertCan } from "@/lib/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;

  const client = await db.client.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
    include: {
      contracts: true,
      projects: true,
      invoices: true,
      payments: { where: { status: "CONFIRMED" } },
      timelineEvents: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
  if (!client) return err("Client introuvable", 404);

  // Re-fetch invoices with items to compute precise totals (discount/tax aware)
  const invoicesWithItems = await db.invoice.findMany({
    where: { clientId: id },
    include: { items: true },
  });
  const totalValue = invoicesWithItems.reduce((s, inv) => {
    const subtotal = inv.items.reduce(
      (acc, it) => acc + (it.qty || 0) * (it.unitPrice || 0),
      0,
    );
    const discountAmount = subtotal * ((inv.discount || 0) / 100);
    const taxableBase = subtotal - discountAmount;
    const taxAmount = taxableBase * ((inv.taxRate || 0) / 100);
    return s + Math.round(taxableBase + taxAmount);
  }, 0);

  const totalPaid = client.payments.reduce((s, p) => s + p.amount, 0);

  const stats = {
    totalValue,
    totalPaid,
    balance: totalValue - totalPaid,
    projectsCount: client.projects.length,
    contractsCount: client.contracts.length,
    invoicesCount: client.invoices.length,
  };

  // Strip relations from the client object for the response, keep scalars + timeline
  const {
    contracts: _c,
    projects: _p,
    invoices: _i,
    payments: _pay,
    timelineEvents,
    ...clientScalars
  } = client;

  return ok({ client: clientScalars, stats, timeline: timelineEvents });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const body = await req.json();
  const existing = await db.client.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Client introuvable", 404);

  const allowed: any = {};
  for (const k of [
    "firstName",
    "lastName",
    "company",
    "email",
    "phone",
    "address",
    "country",
    "taxId",
    "notes",
    "portalToken",
  ]) {
    if (k in body) allowed[k] = body[k];
  }

  const updated = await db.client.update({ where: { id }, data: allowed });
  return ok(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  // Gate destructive action: require manage_clients (OWNER/ADMIN have it).
  try {
    assertCan(ctx, "manage_clients");
  } catch {
    return err("Permission refusée", 403);
  }

  const { id } = await params;
  const existing = await db.client.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Client introuvable", 404);
  await db.client.delete({ where: { id } });

  await audit(
    ctx.user.organizationId,
    ctx.user.id,
    "CLIENT_DELETED",
    id,
    `Client « ${existing.firstName} ${existing.lastName} » supprimé`,
    { clientId: id },
  );

  return ok({ deleted: true });
}
