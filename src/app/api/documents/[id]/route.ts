import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const existing = await db.document.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Introuvable", 404);
  await db.document.delete({ where: { id } });
  return ok({ deleted: true });
}
