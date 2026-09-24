import { NextRequest } from "next/server";
import { ok, err } from "@/lib/server";
import { db } from "@/lib/db";

/**
 * GET /api/invitations/preview?token=TOKEN — public lookup of an invitation.
 * Returns the invitation's email + org name + role if valid (no auth required),
 * so the Register form can prefill the locked email field.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return err("Jeton manquant", 400);

  const invitation = await db.invitation.findUnique({
    where: { token },
    include: { organization: { select: { name: true } } },
  });

  if (
    !invitation ||
    invitation.acceptedAt ||
    invitation.expiresAt.getTime() < Date.now()
  ) {
    return err("Invitation invalide ou expirée", 400);
  }

  return ok({
    email: invitation.email,
    role: invitation.role,
    organizationName: invitation.organization.name,
    expiresAt: invitation.expiresAt,
  });
}
