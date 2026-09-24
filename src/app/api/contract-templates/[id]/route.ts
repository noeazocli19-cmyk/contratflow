import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const item = await db.contractTemplate.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!item) return err("Modèle introuvable", 404);
  return ok(item);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const body = await req.json();
  const existing = await db.contractTemplate.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Modèle introuvable", 404);

  const data: any = {};
  for (const k of [
    "name",
    "description",
    "content",
    "defaultAmount",
    "currency",
  ]) {
    if (k in body) data[k] = body[k];
  }
  const updated = await db.contractTemplate.update({ where: { id }, data });
  return ok(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const existing = await db.contractTemplate.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Modèle introuvable", 404);
  await db.contractTemplate.delete({ where: { id } });
  return ok({ deleted: true });
}
