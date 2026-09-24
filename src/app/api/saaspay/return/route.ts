// GET /api/saaspay/return?ref=REFERENCE
// User is redirected here after paying on SasPay's hosted checkout (success only —
// SasPay's return_url is not called on failure/cancel, see docs).
// We NEVER trust the browser redirect alone: we re-verify the real status
// against SasPay before activating anything. The webhook-driven reconciliation
// sweep is the source of truth; this is just a fast UX path.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrderStatus } from "@/lib/saaspay";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const ref = url.searchParams.get("ref");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  if (!ref) return NextResponse.redirect(`${appUrl}/?pay=error`);

  const order = await db.saaSPayOrder.findUnique({ where: { reference: ref } });
  if (!order) return NextResponse.redirect(`${appUrl}/?pay=error`);

  const status = await getOrderStatus(ref); // re-fetches from SasPay, settles if paid

  if (status === "PAID") return NextResponse.redirect(`${appUrl}/?pay=success`);
  if (status === "CANCELED") return NextResponse.redirect(`${appUrl}/?pay=canceled`);
  if (status === "FAILED") return NextResponse.redirect(`${appUrl}/?pay=failed`);
  return NextResponse.redirect(`${appUrl}/?pay=pending`);
}