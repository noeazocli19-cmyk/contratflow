import { NextRequest } from "next/server";
import { getCtx, ok, err, genToken, timeline } from "@/lib/server";
import { db } from "@/lib/db";

// POST /api/prospects/:id/convert — convert prospect into a client
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);
  const { id } = await params;

  const prospect = await db.prospect.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  });
  if (!prospect) return err("Prospect introuvable", 404);

  if (prospect.status === "CONVERTED" && prospect.convertedClientId) {
    const existing = await db.client.findUnique({
      where: { id: prospect.convertedClientId },
    });
    if (existing) return ok({ client: existing });
  }

  // Split name into first/last
  const parts = prospect.name.trim().split(/\s+/);
  const firstName = parts[0] ?? prospect.name;
  const lastName = parts.slice(1).join(" ") || "";

  const client = await db.client.create({
    data: {
      organizationId: ctx.user.organizationId,
      firstName,
      lastName,
      company: prospect.company,
      email: prospect.email,
      phone: prospect.phone,
      portalToken: genToken(),
    },
  });

  await db.prospect.update({
    where: { id: prospect.id },
    data: { status: "CONVERTED", convertedClientId: client.id },
  });

  await timeline(
    client.id,
    "LEAD_CREATED",
    `Client converti depuis le prospect « ${prospect.name} »`,
  );

  return ok({ client }, 201);
}
