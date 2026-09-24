import { NextRequest } from "next/server";
import { getCtx, ok, err, timeline } from "@/lib/server";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id, taskId } = await params;

  // Verify task belongs to a project of this tenant
  const task = await db.task.findFirst({
    where: {
      id: taskId,
      project: { id, organizationId: ctx.user.organizationId },
    },
  });
  if (!task) return err("Tâche introuvable", 404);

  const body = await req.json();
  const allowed: Record<string, unknown> = {};
  for (const key of [
    "title",
    "description",
    "status",
    "priority",
    "dueDate",
    "assigneeId",
    "order",
  ]) {
    if (key in body) {
      const v = body[key];
      if (key === "dueDate") {
        allowed[key] = v ? new Date(v) : null;
      } else {
        allowed[key] = v;
      }
    }
  }

  const wasNotDone = task.status !== "DONE";
  const updated = await db.task.update({ where: { id: taskId }, data: allowed });

  // Fire timeline event when task transitions to DONE
  if (wasNotDone && updated.status === "DONE") {
    const project = await db.project.findUnique({ where: { id } });
    if (project) {
      await timeline(
        project.clientId,
        "TASK_DONE",
        `Tâche « ${updated.title} » terminée`,
        { projectId: id },
      );
    }
  }

  return ok(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id, taskId } = await params;
  const task = await db.task.findFirst({
    where: {
      id: taskId,
      project: { id, organizationId: ctx.user.organizationId },
    },
  });
  if (!task) return err("Tâche introuvable", 404);
  await db.task.delete({ where: { id: taskId } });
  return ok({ deleted: true });
}
