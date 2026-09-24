// POST /api/saaspay/webhook
// Receives async events from SasPay (configured once in the SasPay dashboard,
// not per-request). Verifies the HMAC signature, then triggers a
// reconciliation sweep of our own PENDING orders — the event payload itself
// carries no merchant reference to match directly (see src/lib/saaspay.ts).
// Public (no auth) — protected by HMAC signature + timestamp tolerance.

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, reconcilePendingOrders } from "@/lib/saaspay";

const RELEVANT_EVENTS = new Set(["transaction.created", "transaction.success", "transaction.failed", "transaction.cancelled"]);

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-webhook-signature") || "";
  const timestamp = req.headers.get("x-webhook-timestamp") || "";
  const eventType = req.headers.get("x-webhook-event") || "";

  if (!verifyWebhookSignature(rawBody, signature, timestamp)) {
    return NextResponse.json({ error: "Signature invalide ou expirée" }, { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Payload JSON invalide" }, { status: 400 });
  }

  const event = String(payload.event || eventType || "");
  console.log(`[saspay webhook] ${event}`);

  if (RELEVANT_EVENTS.has(event) || eventType === "webhook.test") {
    try {
      // We don't get our reference in the payload, so we re-verify our own
      // PENDING orders directly against SasPay (source of truth). Cheap and
      // safe given the low volume of concurrent subscription checkouts.
      await reconcilePendingOrders();
    } catch (e) {
      console.error("SasPay webhook reconciliation error:", e);
      return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}