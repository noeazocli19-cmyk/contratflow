import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 1) return ok({ clients: [], prospects: [], invoices: [], contracts: [], proposals: [], projects: [] });

  const orgId = ctx.user.organizationId;
  const contains = { contains: q };

  const [clients, prospects, invoices, contracts, proposals, projects] =
    await Promise.all([
      db.client.findMany({
        where: {
          organizationId: orgId,
          OR: [
            { firstName: contains },
            { lastName: contains },
            { company: contains },
            { email: contains },
          ],
        },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
      db.prospect.findMany({
        where: {
          organizationId: orgId,
          OR: [
            { name: contains },
            { company: contains },
            { email: contains },
          ],
        },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
      db.invoice.findMany({
        where: { organizationId: orgId, number: contains },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
      db.contract.findMany({
        where: { organizationId: orgId, number: contains },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
      db.proposal.findMany({
        where: {
          organizationId: orgId,
          OR: [{ number: contains }, { title: contains }],
        },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
      db.project.findMany({
        where: { organizationId: orgId, name: contains },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
    ]);

  return ok({
    clients: clients.map((c) => ({
      id: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(" "),
    })),
    prospects: prospects.map((p) => ({ id: p.id, name: p.name })),
    invoices: invoices.map((i) => ({ id: i.id, number: i.number })),
    contracts: contracts.map((c) => ({ id: c.id, number: c.number })),
    proposals: proposals.map((p) => ({ id: p.id, number: p.number, name: p.title })),
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
  });
}
