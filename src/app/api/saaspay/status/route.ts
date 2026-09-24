// GET /api/saaspay/status?ref=REFERENCE
// Poll the status of a SaaSPay order (for the frontend to know when to redirect after payment).

import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";
import { getOrderStatus } from "@/lib/saaspay";

export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  const url = new URL(req.url);
  const ref = url.searchParams.get("ref");
  if (!ref) return err("Référence manquante", 400);

  const existing = await db.saaSPayOrder.findFirst({
    where: { reference: ref, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Commande introuvable", 404);

  // Re-verify against SasPay (cheap: no-op once already PAID) so the frontend
  // polling loop reflects the real gateway state, not a stale PENDING row.
  await getOrderStatus(ref);
  const order = await db.saaSPayOrder.findUnique({ where: { reference: ref } });
  if (!order) return err("Commande introuvable", 404);

  // Also fetch the current subscription to know if it's been activated
  const sub = await db.subscription.findUnique({ where: { organizationId: ctx.user.organizationId } });

  return ok({
    reference: order.reference,
    status: order.status,
    amount: order.amount,
    currency: order.currency,
    paidAt: order.paidAt,
    currentPlan: sub?.plan ?? "FREE",
    subscriptionStatus: sub?.status ?? "INACTIVE",
  });
}