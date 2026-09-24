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
  const items = await db.proposalTemplate.findMany({
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
    title,
    problem,
    solution,
    deliverables,
    timeline,
    amount,
    conditions,
    options,
    notes,
    defaultItems,
  } = body || {};

  if (!name || !title) {
    return err("name et title sont requis", 400);
  }

  const created = await db.proposalTemplate.create({
    data: {
      organizationId: ctx.user.organizationId,
      name,
      description: description ?? null,
      title,
      problem: problem ?? null,
      solution: solution ?? null,
      deliverables: deliverables ?? null,
      timeline: timeline ?? null,
      amount: typeof amount === "number" ? amount : 0,
      conditions: conditions ?? null,
      options: options ?? null,
      notes: notes ?? null,
      defaultItems: normalizeDefaultItems(defaultItems),
    },
  });
  return ok(created, 201);
}
