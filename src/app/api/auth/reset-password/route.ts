// POST /api/auth/reset-password — uses Better Auth's resetPassword.
// Body: { token, password }
// Returns: { ok: true } (with session cookie set automatically)

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/server";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { token, password } = body as { token?: string; password?: string };

  if (!token) return err("Token manquant", 400);
  if (!password || password.length < 8) return err("Mot de passe : au moins 8 caractères", 400);

  try {
    const hdrs = new Headers(req.headers);
    await auth.api.resetPassword({
      body: { token, newPassword: password },
      headers: hdrs,
    });
    return ok({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Token invalide ou expiré";
    return err(msg, 400);
  }
}
