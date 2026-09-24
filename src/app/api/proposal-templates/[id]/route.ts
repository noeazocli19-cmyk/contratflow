import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

function normalizeDefaultItems(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    if (value.trim() === "") return null;
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return JSON.stringify(parsed);
    } catch {
      // ignore
    }
    return value;
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const item = await db.proposalTemplate.findFirst({
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
  const existing = await db.proposalTemplate.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Modèle introuvable", 404);

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of [
    "name",
    "description",
    "title",
    "problem",
    "solution",
    "deliverables",
    "timeline",
    "conditions",
    "options",
    "notes",
  ]) {
    if (k in body) data[k] = body[k] ?? null;
  }
  if (typeof body.amount === "number") data.amount = body.amount;
  if ("defaultItems" in body) data.defaultItems = normalizeDefaultItems(body.defaultItems);

  const updated = await db.proposalTemplate.update({ where: { id }, data });
  return ok(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const existing = await db.proposalTemplate.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!existing) return err("Modèle introuvable", 404);
  await db.proposalTemplate.delete({ where: { id } });
  return ok({ deleted: true });
}
