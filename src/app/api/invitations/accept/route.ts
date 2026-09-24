// POST /api/invitations/accept
// Body: { token, name, password }
// No auth required.
//
// Looks up the invitation by token (unaccepted + not expired).
// - If a user with the invitation's email already exists, just move them into
//   the new org (update their organizationId) and sign them in via Better Auth.
// - Otherwise, sign them up via Better Auth (creates User + Account credential),
//   then link them to the invitation's org.
// - Mark the invitation as accepted, sign in via Better Auth, return user+org.

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return err("Requête invalide", 400);

  const { token, name, password } = body as {
    token?: string;
    name?: string;
    password?: string;
  };

  if (!token || typeof token !== "string") return err("Jeton invalide", 400);
  if (!password || password.length < 8) return err("Mot de passe trop court (min 8)", 400);

  const invitation = await db.invitation.findUnique({
    where: { token },
    include: { organization: true },
  });

  if (!invitation || invitation.acceptedAt || invitation.expiresAt.getTime() < Date.now()) {
    return err("Invitation invalide ou expirée", 400);
  }

  const email = invitation.email.toLowerCase();
  const hdrs = new Headers(req.headers);
  const existingUser = await db.user.findUnique({ where: { email } });

  let userId: string;

  try {
    if (existingUser) {
      // Already a user — just move them into this org.
      if (existingUser.organizationId === invitation.organizationId) {
        return err("Cet email fait déjà partie de votre organisation", 400);
      }
      await db.user.update({
        where: { id: existingUser.id },
        data: {
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
      });
      userId = existingUser.id;

      // Sign in via Better Auth (creates a session)
      await auth.api.signInEmail({
        body: { email, password },
        headers: hdrs,
      });
    } else {
      // Validate name only when creating a new user.
      if (!name || name.trim().length < 1) return err("Nom requis", 400);

      // Create the user via Better Auth (creates User + Account credential)
      const result = await auth.api.signUpEmail({
        body: { email, password, name: name.trim(), role: invitation.role, onboardingStep: 1 },
        headers: hdrs,
      });
      userId = result.user.id;

      // Link them to the invitation's org
      await db.user.update({
        where: { id: userId },
        data: {
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
      });

      // Make sure they have a subscription row at the org level (idempotent).
      const sub = await db.subscription.findUnique({
        where: { organizationId: invitation.organizationId },
      });
      if (!sub) {
        await db.subscription.create({
          data: {
            organizationId: invitation.organizationId,
            plan: "FREE",
            status: "ACTIVE",
            seats: 1,
          },
        });
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur lors de l'acceptation";
    return err(msg, 400);
  }

  await db.invitation.update({
    where: { id: invitation.id },
    data: { acceptedAt: new Date() },
  });

  const user = await db.user.findUnique({
    where: { id: userId },
    include: { organization: true },
  });

  return ok({ user, organization: user?.organization });
}
