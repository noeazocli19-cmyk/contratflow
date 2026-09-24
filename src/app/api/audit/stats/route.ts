import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

// GET /api/audit/stats — counts by action for the current org (for the audit
// overview chart + quick filter chips). Sorted by count desc.
export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  const rows = await db.auditLog.groupBy({
    by: ["action"],
    where: { organizationId: ctx.user.organizationId },
    _count: { _all: true },
    orderBy: { _count: { action: "desc" } },
  });

  const total = rows.reduce((s, r) => s + r._count._all, 0);

  return ok({
    total,
    byAction: rows.map((r) => ({
      action: r.action,
      count: r._count._all,
    })),
  });
}
