import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return err("Requête invalide", 400);

  const { read } = body as { read?: boolean };
  if (typeof read !== "boolean") return err("Champ `read` invalide", 400);

  const existing = await db.notification.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Notification introuvable", 404);

  const updated = await db.notification.update({
    where: { id },
    data: { read },
  });
  return ok(updated);
}
