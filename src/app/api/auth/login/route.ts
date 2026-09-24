// POST /api/auth/login — thin wrapper around Better Auth's signInEmail.
// Body: { email, password }
// Returns: { user, organization } (with session cookie set automatically)

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return err("Requête invalide", 400);

  const { email, password } = body as { email?: string; password?: string };

  if (!email || !EMAIL_RE.test(email)) return err("Email invalide", 400);
  if (!password || password.length < 6) return err("Mot de passe invalide", 400);

  try {
    // Convert Next.js Request headers to a plain Headers for Better Auth
    const hdrs = new Headers(req.headers);
    const result = await auth.api.signInEmail({
      body: { email, password },
      headers: hdrs,
    });

    // Fetch the user's organization (Better Auth's user object doesn't include it)
    const fullUser = await db.user.findUnique({
      where: { id: result.user.id },
      include: { organization: true },
    });

    if (!fullUser?.organization) return err("Compte sans organisation", 400);

    return ok({ user: fullUser, organization: fullUser.organization });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Identifiants invalides";
    if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("unauthorized")) {
      return err("Identifiants invalides", 401);
    }
    return err(msg, 400);
  }
}
