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

export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const items = await db.quoteTemplate.findMany({
    where: { organizationId: ctx.user.organizationId },
    orderBy: { createdAt: "desc" },
  });
  return ok(items);
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const body = await req.json();
  const {
    name,
    description,
    terms,
    notes,
    discount,
    taxRate,
    defaultItems,
  } = body || {};

  if (!name) return err("name est requis", 400);

  const created = await db.quoteTemplate.create({
    data: {
      organizationId: ctx.user.organizationId,
      name,
      description: description ?? null,
      terms: terms ?? null,
      notes: notes ?? null,
      discount: typeof discount === "number" ? Math.min(100, Math.max(0, discount)) : 0,
      taxRate: typeof taxRate === "number" ? Math.min(100, Math.max(0, taxRate)) : 0,
      defaultItems: normalizeDefaultItems(defaultItems),
    },
  });
  return ok(created, 201);
}
