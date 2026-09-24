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
  const item = await db.prospect.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!item) return err("Prospect introuvable", 404);
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
  const existing = await db.prospect.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Prospect introuvable", 404);

  const data: any = {};
  const allowed = [
    "name",
    "company",
    "email",
    "phone",
    "sector",
    "source",
    "status",
    "notes",
    "potentialValue",
  ];
  for (const k of allowed) {
    if (k in body) data[k] = body[k];
  }
  if ("contactedAt" in body) {
    data.contactedAt = body.contactedAt ? new Date(body.contactedAt) : null;
  }
  if ("nextActionAt" in body) {
    data.nextActionAt = body.nextActionAt ? new Date(body.nextActionAt) : null;
  }

  const updated = await db.prospect.update({ where: { id }, data });
  return ok(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const existing = await db.prospect.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Prospect introuvable", 404);
  await db.prospect.delete({ where: { id } });
  return ok({ deleted: true });
}
