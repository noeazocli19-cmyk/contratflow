import { NextRequest } from "next/server";
import { getCtx, ok, err, assertCan } from "@/lib/server";
import { db } from "@/lib/db";

/**
 * DELETE /api/invitations/:id — cancel (revoke) a pending invitation.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  try {
    assertCan(ctx, "manage_team");
  } catch {
    return err("Permission refusée", 403);
  }

  const { id } = await params;
  const invitation = await db.invitation.findFirst({
    where: {
      id,
      organizationId: ctx.user.organizationId,
      acceptedAt: null,
    },
  });
  if (!invitation) return err("Invitation introuvable", 404);

  await db.invitation.delete({ where: { id: invitation.id } });
  return ok({ deleted: true });
}
