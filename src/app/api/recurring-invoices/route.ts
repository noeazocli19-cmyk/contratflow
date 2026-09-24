// Recurring invoices — for freelancers who bill clients on a recurring basis.

import { NextRequest } from "next/server";
import { getCtx, ok, err, nextNumber, notify, timeline } from "@/lib/server";
import { db } from "@/lib/db";

export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  const items = await db.recurringInvoice.findMany({
    where: { organizationId: ctx.user.organizationId },
    include: { client: true },
    orderBy: { nextRunAt: "asc" },
  });
  return ok(items);
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  // PRO/AGENCY only
  const sub = await db.subscription.findUnique({ where: { organizationId: ctx.user.organizationId } });
  if (!sub || (sub.plan !== "PRO" && sub.plan !== "AGENCY")) {
    return err("Factures récurrentes disponibles sur le plan Pro.", 402);
  }

  const body = await req.json().catch(() => ({}));
  const { clientId, name, frequency, amount, currency, nextRunAt } = body as Record<string, unknown>;

  if (!clientId || !name || !amount) return err("clientId, name et amount requis", 400);

  const client = await db.client.findFirst({
    where: { id: String(clientId), organizationId: ctx.user.organizationId },
  });
  if (!client) return err("Client introuvable", 404);

  const recurring = await db.recurringInvoice.create({
    data: {
      organizationId: ctx.user.organizationId,
      clientId: String(clientId),
      name: String(name),
      frequency: String(frequency || "MONTHLY"),
      amount: Number(amount),
      currency: String(currency || "XOF"),
      nextRunAt: new Date(String(nextRunAt || new Date())),
      active: true,
    },
  });

  return ok(recurring, 201);
}
