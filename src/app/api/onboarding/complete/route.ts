import { ok, err } from "@/lib/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST() {
  const current = await getCurrentUser();
  if (!current) return err("Non authentifié", 401);

  const user = await db.user.update({
    where: { id: current.user.id },
    data: { onboardingStep: 9 },
    include: { organization: true },
  });

  // Better Auth manages the session cookie automatically — no need to re-sign.
  return ok({ user, organization: user.organization });
}
