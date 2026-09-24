// POST /api/auth/forgot-password — triggers Better Auth's forgetPassword.
// Body: { email }
// Returns: { message, devToken? } (devToken is the actual token in dev mode for testing)

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();

  if (!EMAIL_RE.test(email)) return err("Email invalide", 400);

  // Don't leak existence: always return the same message
  const msg = { message: "Si cet email existe, un lien de réinitialisation a été envoyé." };

  try {
    const hdrs = new Headers(req.headers);
    // Better Auth's forgetPassword creates a verification token in DB.
    // In production, it triggers sendResetPassword (configured in src/lib/auth.ts).
    await auth.api.forgetPassword({
      body: { email, redirectURL: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/?reset=1` },
      headers: hdrs,
    });

    // In dev, fetch the latest verification token for this email to return as devToken
    if (process.env.NODE_ENV !== "production") {
      const verification = await db.verification.findFirst({
        where: { identifier: email },
        orderBy: { createdAt: "desc" },
      });
      if (verification) {
        return ok({ ...msg, devToken: verification.value });
      }
    }
  } catch (e) {
    console.error("forgotPassword error:", e);
  }

  return ok(msg);
}
