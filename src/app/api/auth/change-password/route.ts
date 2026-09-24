// POST /api/auth/change-password — uses Better Auth's changePassword.
// Auth required. Body: { currentPassword, newPassword }
// Returns: { ok: true }

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/server";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { currentPassword, newPassword } = body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword) return err("Mot de passe actuel requis", 400);
  if (!newPassword || newPassword.length < 8) return err("Nouveau mot de passe : au moins 8 caractères", 400);
  if (currentPassword === newPassword) return err("Le nouveau mot de passe doit être différent", 400);

  try {
    const hdrs = new Headers(req.headers);
    await auth.api.changePassword({
      body: { currentPassword, newPassword, newPasswordConfirm: newPassword },
      headers: hdrs,
    });
    return ok({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur lors du changement de mot de passe";
    return err(msg, 400);
  }
}
