import { NextRequest } from "next/server";
import { getCtx, ok, err, genToken, assertCan, audit } from "@/lib/server";
import { db } from "@/lib/db";
import { checkLimit } from "@/lib/plans";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const VALID_ROLES = new Set(["OWNER", "ADMIN", "MEMBER"]);

/**
 * GET /api/members — list users in the current org (oldest first).
 */
export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  const users = await db.user.findMany({
    where: { organizationId: ctx.user.organizationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      avatarUrl: true,
      role: true,
      organizationId: true,
      onboardingStep: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return ok(users);
}

/**
 * POST /api/members — create an invitation for `email` with `role`.
 * Body: { email, role }
 *
 * Sandbox note: returns the devInviteLink so the inviter can share it
 * (production would send an email).
 */
export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  try {
    assertCan(ctx, "manage_team");
  } catch {
    return err("Permission refusée", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return err("Requête invalide", 400);

  const { email, role } = body as { email?: string; role?: string };
  if (!email || !EMAIL_RE.test(email))
    return err("Email invalide", 400);
  const normalizedEmail = email.trim().toLowerCase();
  const finalRole = role && VALID_ROLES.has(role) ? role : "MEMBER";

  // Plan limit — maxMembers (count current members, invitations count separately
  // since they are not yet active).
  const currentMembers = await db.user.count({
    where: { organizationId: ctx.user.organizationId },
  });
  const limit = await checkLimit(
    ctx.user.organizationId,
    "maxMembers",
    currentMembers,
  );
  if (!limit.ok) {
    return err(
      `Limite du plan ${limit.plan} atteinte : ${limit.max} membre(s) maximum. Passez à un plan supérieur pour inviter plus de membres.`,
      402,
    );
  }

  // Prevent inviting an already-member of this org.
  const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
  if (existing && existing.organizationId === ctx.user.organizationId) {
    return err("Cet email fait déjà partie de votre organisation", 400);
  }

  // Don't stack pending invitations for the same email in this org.
  const pending = await db.invitation.findFirst({
    where: {
      organizationId: ctx.user.organizationId,
      email: normalizedEmail,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (pending) {
    return err("Une invitation est déjà en attente pour cet email", 400);
  }

  const token = genToken(32);
  const invitation = await db.invitation.create({
    data: {
      organizationId: ctx.user.organizationId,
      email: normalizedEmail,
      role: finalRole,
      token,
      invitedBy: ctx.user.id,
      expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
    },
  });

  await audit(
    ctx.user.organizationId,
    ctx.user.id,
    "MEMBER_INVITED",
    invitation.id,
    `Invitation envoyée à ${normalizedEmail} (rôle : ${finalRole})`,
    { invitationId: invitation.id, email: normalizedEmail, role: finalRole },
  );

  // Dev-only: the inviter can copy/paste this link to the invitee.
  const devInviteLink = `?invite=${token}`;

  return ok({ invitation, devInviteLink }, 201);
}
