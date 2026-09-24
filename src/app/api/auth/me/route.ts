// GET /api/auth/me — returns the current user + organization from Better Auth session.

import { ok, err } from "@/lib/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const ctx = await getCurrentUser();
  if (!ctx) return err("Non authentifié", 401);
  return ok({ user: ctx.user, organization: ctx.user.organization });
}
