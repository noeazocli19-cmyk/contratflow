// ContractFlow — SasPay integration (https://saspay.me)
// Réf. doc officielle : https://docs.saspay.me
//
// SasPay expose une API REST unique pour encaisser (mobile money + carte) en
// Afrique de l'Ouest et du Centre via une page de checkout hébergée.
//
// Base URL   : https://api.saspay.me/api/v1
// Auth       : Authorization: Bearer sk_live_xxx (ou sk_test_xxx en test)
//
// Particularité importante : POST /checkout-sessions/ ne prend PAS de
// référence marchand ni de webhook_url — SasPay génère son propre `id` de
// session, et les webhooks sont configurés une fois pour toutes depuis le
// tableau de bord (pas par requête). Le payload d'un event `transaction.*`
// ne contient pas notre metadata — donc on ne peut pas mapper un event à une
// session par son seul contenu. On corrèle donc en re-vérifiant nous-mêmes
// (via GET /checkout-sessions/{id}/) les commandes PENDING à chaque event
// reçu ("sweep" de réconciliation), plutôt qu'en essayant de lire une
// référence qui n'existe pas dans le payload.

import { db } from "@/lib/db";
import { PLAN_PRICE_FCFA, PLAN_CURRENCY, PLAN_INTERVAL } from "@/lib/plans";
import { audit, notify } from "@/lib/server";
import crypto from "crypto";

const SECRET_KEY = process.env.SASPAY_SECRET_KEY || process.env.SAASPAY_SECRET_KEY || "";
const WEBHOOK_SECRET = process.env.SASPAY_WEBHOOK_SECRET || process.env.SAASPAY_WEBHOOK_SECRET || "";
const API_BASE = process.env.SASPAY_API_BASE || "https://api.saspay.me/api/v1";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const WEBHOOK_TOLERANCE_SECONDS = 300;

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SECRET_KEY}`,
  };
}

export type SaasPayCheckoutInput = {
  organizationId: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  plan: "PRO" | "AGENCY";
  amount?: number; // override (defaults to plan price)
  currency?: string; // defaults to XOF
};

export type SaasPayCheckoutResult = {
  reference: string;       // our internal order ref
  checkoutUrl: string;     // redirect the user here to pay
  amount: number;
  currency: string;
};

export type SaasPayOrderStatus = "PENDING" | "PAID" | "FAILED" | "CANCELED" | "REFUNDED";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Create a checkout session — POST /checkout-sessions/
// ─────────────────────────────────────────────────────────────────────────────
export async function createCheckout(input: SaasPayCheckoutInput): Promise<SaasPayCheckoutResult> {
  const amount = input.amount ?? PLAN_PRICE_FCFA;
  const currency = input.currency ?? PLAN_CURRENCY;
  const reference = `CF-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  if (!SECRET_KEY) {
    throw new Error("SASPAY_SECRET_KEY manquant — configurez votre clé API SasPay (tableau de bord → Développeur).");
  }

  const res = await fetch(`${API_BASE}/checkout-sessions/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      amount: amount.toFixed(2),
      currency,
      description: `ContractFlow — abonnement ${input.plan}`,
      country: "BJ",
      customer_email: input.customerEmail,
      customer_name: input.customerName,
      customer_phone: input.customerPhone || "",
      // SasPay ne redirige que sur succès (voir doc) — l'échec/annulation reste
      // géré côté page hébergée (bouton "Réessayer").
      return_url: `${APP_URL}/api/saaspay/return?ref=${reference}`,
      metadata: { organization_id: input.organizationId, plan: input.plan, reference },
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    const msg = data?.error?.message || data?.message || `SasPay createCheckout a échoué (HTTP ${res.status})`;
    throw new Error(msg);
  }

  await db.saaSPayOrder.create({
    data: {
      organizationId: input.organizationId,
      amount,
      currency,
      reference,
      externalSessionId: data.id,
      status: "PENDING",
      checkoutUrl: data.checkout_url,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone ?? null,
    },
  });

  return { reference, checkoutUrl: data.checkout_url, amount, currency };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Poll a single order's real status — GET /checkout-sessions/{id}/
// ─────────────────────────────────────────────────────────────────────────────
export async function getOrderStatus(reference: string): Promise<SaasPayOrderStatus> {
  const order = await db.saaSPayOrder.findUnique({ where: { reference } });
  if (!order) return "FAILED";
  if (order.status === "PAID") return "PAID"; // already settled, no need to re-poll

  if (order.externalSessionId && SECRET_KEY) {
    try {
      const res = await fetch(`${API_BASE}/checkout-sessions/${order.externalSessionId}/`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const mapped = mapSessionStatus(data.status, !!data.paid_at);
        if (mapped === "PAID" && order.status !== "PAID") {
          await markOrderPaid(reference, { source: "poll", session: data });
        } else if (mapped !== "PENDING" && mapped !== order.status) {
          await db.saaSPayOrder.update({ where: { reference }, data: { status: mapped } });
        }
        return mapped;
      }
    } catch (e) {
      console.error("SasPay getOrderStatus poll error:", e);
    }
  }

  return order.status as SaasPayOrderStatus;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Verify webhook signature — HMAC-SHA256(`${timestamp}.${rawBody}`)
// ─────────────────────────────────────────────────────────────────────────────
export function verifyWebhookSignature(rawBody: string, signature: string, timestamp: string): boolean {
  if (!WEBHOOK_SECRET || !signature || !timestamp) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS) return false;

  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Reconciliation sweep — called from the webhook route on any
//    transaction.* event, since the event payload carries no merchant
//    reference we can match directly. Re-checks our own PENDING orders
//    against SasPay's real state.
// ─────────────────────────────────────────────────────────────────────────────
export async function reconcilePendingOrders(): Promise<void> {
  const pending = await db.saaSPayOrder.findMany({
    where: { status: "PENDING", externalSessionId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 25, // bounded sweep — subscription checkout volume is low
  });

  for (const order of pending) {
    await getOrderStatus(order.reference); // re-fetches + settles as a side effect
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Mark an order as paid (called from poll, return URL, or reconciliation)
// ─────────────────────────────────────────────────────────────────────────────
export async function markOrderPaid(reference: string, rawPayload?: unknown) {
  const order = await db.saaSPayOrder.findUnique({ where: { reference } });
  if (!order) throw new Error(`Order ${reference} not found`);
  if (order.status === "PAID") {
    const sub = await db.subscription.findUnique({ where: { organizationId: order.organizationId } });
    return { organizationId: order.organizationId, plan: (sub?.plan as "PRO" | "AGENCY") || "PRO" };
  }

  const txnId =
    rawPayload && typeof rawPayload === "object" && "session" in (rawPayload as Record<string, unknown>)
      ? ((rawPayload as { session?: { transaction?: string } }).session?.transaction ?? null)
      : null;

  await db.saaSPayOrder.update({
    where: { reference },
    data: {
      status: "PAID",
      paidAt: new Date(),
      externalTxnId: txnId ?? order.externalTxnId,
      rawPayload: rawPayload ? JSON.stringify(rawPayload) : order.rawPayload,
    },
  });

  const plan: "PRO" | "AGENCY" = order.amount >= PLAN_PRICE_FCFA * 2 ? "AGENCY" : "PRO";

  const renewDate = new Date();
  if (PLAN_INTERVAL === "MONTHLY") renewDate.setMonth(renewDate.getMonth() + 1);
  else if (PLAN_INTERVAL === "YEARLY") renewDate.setFullYear(renewDate.getFullYear() + 1);
  else renewDate.setDate(renewDate.getDate() + 36500);

  await db.subscription.upsert({
    where: { organizationId: order.organizationId },
    create: {
      organizationId: order.organizationId,
      plan,
      status: "ACTIVE",
      renewsAt: renewDate,
      seats: plan === "AGENCY" ? 5 : 1,
    },
    update: {
      plan,
      status: "ACTIVE",
      renewsAt: renewDate,
      seats: plan === "AGENCY" ? 5 : 1,
    },
  });

  await notify(
    order.organizationId,
    "PAYMENT_RECEIVED",
    "Paiement SasPay reçu",
    `Votre abonnement ${plan} est maintenant actif. Merci !`,
  );
  await audit(
    order.organizationId,
    undefined,
    "SASPAY_PAYMENT_CONFIRMED",
    reference,
    `Paiement SasPay confirmé pour la commande ${reference}`,
    { reference, plan, source: rawPayload && typeof rawPayload === "object" ? (rawPayload as Record<string, unknown>).source : undefined },
  );

  return { organizationId: order.organizationId, plan };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: map SasPay checkout-session status → our enum
// ─────────────────────────────────────────────────────────────────────────────
function mapSessionStatus(s: string, hasPaidAt: boolean): SaasPayOrderStatus {
  const v = (s || "").toUpperCase();
  if (hasPaidAt || ["PAID", "SUCCESS", "COMPLETED"].includes(v)) return "PAID";
  if (["CANCELLED", "CANCELED"].includes(v)) return "CANCELED";
  if (["EXPIRED", "FAILED"].includes(v)) return "FAILED";
  return "PENDING";
}

export { API_BASE };