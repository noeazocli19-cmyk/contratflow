// POST /api/saaspay/checkout
// Initiate a SasPay checkout for the SaaS subscription.
// Auth required. Body: { plan: 'PRO' | 'AGENCY' }
// Returns: { reference, checkoutUrl, amount, currency }

import { NextRequest } from "next/server";
import { getCtx, ok, err, audit } from "@/lib/server";
import { createCheckout } from "@/lib/saaspay";
import { PLANS } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  const body = await req.json().catch(() => ({}));
  const plan = (body.plan || "PRO") as "PRO" | "AGENCY";
  if (plan !== "PRO" && plan !== "AGENCY") return err("Plan invalide", 400);

  try {
    const result = await createCheckout({
      organizationId: ctx.user.organizationId,
      customerEmail: ctx.user.email,
      customerName: ctx.user.name || ctx.user.email,
      customerPhone: ctx.user.phone ?? undefined,
      plan,
      amount: PLANS[plan].price,
    });

    await audit(
      ctx.user.organizationId,
      ctx.user.id,
      "SASPAY_CHECKOUT_INITIATED",
      result.reference,
      `Paiement SasPay initié pour le plan ${plan} (${result.amount} ${result.currency})`,
      { reference: result.reference, plan, amount: result.amount },
    );

    return ok(result, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur SasPay";
    return err(msg, 502);
  }
}