import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

/**
 * GET /api/invitations — list pending invitations for the current org.
 */
export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  const invitations = await db.invitation.findMany({
    where: {
      organizationId: ctx.user.organizationId,
      acceptedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  return ok(invitations);
}
