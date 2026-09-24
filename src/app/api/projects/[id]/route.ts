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
  const item = await db.project.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
    include: {
      client: true,
      tasks: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!item) return err("Introuvable", 404);
  return ok(item);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const existing = await db.project.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Introuvable", 404);

  const body = await req.json();
  const allowed: Record<string, unknown> = {};
  for (const key of [
    "name",
    "description",
    "budget",
    "startDate",
    "endDate",
    "status",
    "progress",
  ]) {
    if (key in body) {
      const v = body[key];
      if (key === "startDate" || key === "endDate") {
        allowed[key] = v ? new Date(v) : null;
      } else if (key === "budget") {
        allowed[key] = typeof v === "number" ? v : existing.budget;
      } else if (key === "progress") {
        allowed[key] = typeof v === "number" ? v : existing.progress;
      } else {
        allowed[key] = v;
      }
    }
  }

  const updated = await db.project.update({
    where: { id },
    data: allowed,
    include: {
      client: true,
      tasks: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
    },
  });
  return ok(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const existing = await db.project.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Introuvable", 404);
  await db.project.delete({ where: { id } });
  return ok({ deleted: true });
}
