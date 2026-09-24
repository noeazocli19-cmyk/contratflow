import { ok, err } from "@/lib/server";
import { db } from "@/lib/db";
import { getCtx } from "@/lib/server";

export async function POST() {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  await db.notification.updateMany({
    where: { organizationId: ctx.user.organizationId, read: false },
    data: { read: true },
  });
  return ok({ ok: true });
}
