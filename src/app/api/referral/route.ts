// Referral program — generate a referral code for an org, track conversions.

import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  // Get the user's referral record + stats
  const referral = await db.referral.findFirst({
    where: { organizationId: ctx.user.organizationId },
  });

  if (!referral) {
    // Auto-create one
    const code = genCode();
    const newRef = await db.referral.create({
      data: {
        organizationId: ctx.user.organizationId,
        referrerEmail: ctx.user.email,
        referrerCode: code,
        commissionPct: 20,
        status: "PENDING",
      },
    });
    return ok({ referral: newRef, stats: { clicks: 0, signups: 0, paid: 0 } });
  }

  // Count conversions (refereeOrgId is set when a referred org signs up)
  const signups = await db.referral.count({
    where: { referralCode: referral.referrerCode, refereeOrgId: { not: null } },
  });

  return ok({ referral, stats: { signups, paid: signups > 0 ? 1 : 0 } });
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  const body = await req.json().catch(() => ({}));
  // Referred-by flow: user signs up with a referral code → we attach them.
  const code = String(body.referralCode || "").toUpperCase();

  if (code) {
    const referrer = await db.referral.findUnique({ where: { referrerCode: code } });
    if (referrer && referrer.organizationId !== ctx.user.organizationId) {
      await db.referral.update({
        where: { id: referrer.id },
        data: {
          refereeEmail: ctx.user.email,
          refereeOrgId: ctx.user.organizationId,
          status: "CONVERTED",
        },
      });
    }
  }

  return ok({ ok: true });
}
