import { NextRequest } from "next/server";
import { getCtx, ok, err, assertCan } from "@/lib/server";
import { db } from "@/lib/db";

const VALID_ROLES = new Set(["OWNER", "ADMIN", "MEMBER"]);

/**
 * PATCH /api/members/:id — change a member's role.
 * Only OWNER can change roles; cannot change own role; cannot demote last OWNER.
 * Body: { role }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  try {
    assertCan(ctx, "manage_team");
  } catch {
    return err("Permission refusée", 403);
  }

  // Only OWNER can change roles (admins can manage_team but not reassign roles).
  if (ctx.user.role !== "OWNER") {
    return err("Seul le propriétaire peut changer les rôles", 403);
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return err("Requête invalide", 400);

  const { role } = body as { role?: string };
  if (!role || !VALID_ROLES.has(role)) return err("Rôle invalide", 400);

  const target = await db.user.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!target) return err("Membre introuvable", 404);

  // Can't change own role.
  if (target.id === ctx.user.id) {
    return err("Vous ne pouvez pas modifier votre propre rôle", 400);
  }

  // Don't demote the last OWNER.
  if (target.role === "OWNER" && role !== "OWNER") {
    const ownersCount = await db.user.count({
      where: { organizationId: ctx.user.organizationId, role: "OWNER" },
    });
    if (ownersCount <= 1) {
      return err("Impossible de rétrograder le dernier propriétaire", 400);
    }
  }

  const updated = await db.user.update({
    where: { id: target.id },
    data: { role },
    include: { organization: true },
  });

  return ok(updated);
}

/**
 * DELETE /api/members/:id — remove a member from the org.
 * Only OWNER can do this; can't remove self if last member; can't remove last OWNER.
 *
 * Note on tenancy: a User belongs to exactly one Organization (no array of orgs).
 * "Removing from org" here is implemented as deleting the user — if they had
 * data tied to them (tasks assigned), those are nullable so it's safe.
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

  if (ctx.user.role !== "OWNER") {
    return err("Seul le propriétaire peut retirer un membre", 403);
  }

  const { id } = await params;

  const target = await db.user.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!target) return err("Membre introuvable", 404);

  // Can't remove the last OWNER.
  if (target.role === "OWNER") {
    const ownersCount = await db.user.count({
      where: { organizationId: ctx.user.organizationId, role: "OWNER" },
    });
    if (ownersCount <= 1) {
      return err("Impossible de retirer le dernier propriétaire", 400);
    }
  }

  // Can't remove self if you're the last member.
  if (target.id === ctx.user.id) {
    const membersCount = await db.user.count({
      where: { organizationId: ctx.user.organizationId },
    });
    if (membersCount <= 1) {
      return err("Vous êtes le seul membre, impossible de vous retirer", 400);
    }
  }

  await db.user.delete({ where: { id: target.id } });
  return ok({ deleted: true });
}
