import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;
  const project = await db.project.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!project) return err("Projet introuvable", 404);

  const body = await req.json();
  const { title, description, status, priority, dueDate, assigneeId } =
    body || {};
  if (!title) return err("title est requis", 400);

  // Determine next order
  const count = await db.task.count({ where: { projectId: id } });

  const task = await db.task.create({
    data: {
      projectId: id,
      title,
      description: description ?? null,
      status: status ?? "TODO",
      priority: priority ?? "MEDIUM",
      dueDate: dueDate ? new Date(dueDate) : null,
      assigneeId: assigneeId ?? null,
      order: count,
    },
  });
  return ok(task, 201);
}
