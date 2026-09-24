import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

// GET /api/audit — paginated audit logs for the current org.
// Query: ?page=1 (1-indexed), ?action=CLIENT_CREATED (optional filter), ?userId=…
const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  const url = new URL(req.url);
  const pageParam = url.searchParams.get("page");
  const action = url.searchParams.get("action");
  const userId = url.searchParams.get("userId");

  const page = Math.max(1, Number(pageParam || "1"));
  const skip = (page - 1) * PAGE_SIZE;

  const where: {
    organizationId: string;
    action?: string;
    userId?: string;
  } = {
    organizationId: ctx.user.organizationId,
  };
  if (action && action.trim()) where.action = action.trim();
  if (userId && userId.trim()) where.userId = userId.trim();

  const [items, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    db.auditLog.count({ where }),
  ]);

  return ok({
    items: items.map((a) => ({
      id: a.id,
      organizationId: a.organizationId,
      userId: a.userId,
      userName: a.user?.name ?? null,
      userEmail: a.user?.email ?? null,
      action: a.action,
      target: a.target,
      message: a.message,
      metadata: a.metadata,
      createdAt: a.createdAt,
    })),
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
