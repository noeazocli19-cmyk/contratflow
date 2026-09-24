import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  const { searchParams } = new URL(req.url);
  const countOnly = searchParams.get("count") === "true";

  const orgId = ctx.user.organizationId;

  if (countOnly) {
    const count = await db.notification.count({
      where: { organizationId: orgId, read: false },
    });
    return ok({ count });
  }

  const notifications = await db.notification.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
  });
  return ok(notifications);
}
