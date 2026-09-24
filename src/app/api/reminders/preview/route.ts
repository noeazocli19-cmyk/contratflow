import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

// GET /api/reminders/preview
// For the current org, simulate which invoices/contracts/proposals would
// trigger reminders based on existing rules. Returns an array of:
//   { type, target: { id, number, dueDate?, daysLate? }, reminder: { name, channel } }

type PreviewItem = {
  type: string;
  target: {
    id: string;
    number: string;
    dueDate?: string | null;
    daysLate?: number;
    client?: string;
  };
  reminder: { id: string; name: string; channel: string };
};

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export async function GET(_req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  const [reminders, invoices, contracts, proposals] = await Promise.all([
    db.reminder.findMany({
      where: { organizationId: ctx.user.organizationId, active: true },
    }),
    db.invoice.findMany({
      where: {
        organizationId: ctx.user.organizationId,
        status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] },
      },
      include: { client: true },
    }),
    db.contract.findMany({
      where: {
        organizationId: ctx.user.organizationId,
        status: { in: ["SENT", "VIEWED"] },
      },
      include: { client: true },
    }),
    db.proposal.findMany({
      where: {
        organizationId: ctx.user.organizationId,
        status: { in: ["SENT", "VIEWED"] },
      },
      include: { client: true },
    }),
  ]);

  const now = new Date();
  const out: PreviewItem[] = [];

  for (const r of reminders) {
    if (r.trigger === "INVOICE_DUE_SOON") {
      // Fire for invoices whose dueDate is r.daysOffset days away (or fewer).
      for (const inv of invoices) {
        if (!inv.dueDate) continue;
        const daysLeft = daysBetween(new Date(inv.dueDate), now); // positive = future
        if (daysLeft >= 0 && daysLeft <= Math.max(0, r.daysOffset)) {
          out.push({
            type: r.trigger,
            target: {
              id: inv.id,
              number: inv.number,
              dueDate: inv.dueDate.toISOString(),
              daysLate: -daysLeft, // negative = upcoming
              client: inv.client
                ? `${inv.client.firstName} ${inv.client.lastName}`.trim()
                : undefined,
            },
            reminder: { id: r.id, name: r.name, channel: r.channel },
          });
        }
      }
    } else if (r.trigger === "INVOICE_OVERDUE") {
      // Fire for invoices whose due date is past by at least r.daysOffset days.
      for (const inv of invoices) {
        if (!inv.dueDate) continue;
        const daysLate = daysBetween(now, new Date(inv.dueDate)); // positive = past
        if (daysLate >= Math.max(0, r.daysOffset)) {
          out.push({
            type: r.trigger,
            target: {
              id: inv.id,
              number: inv.number,
              dueDate: inv.dueDate.toISOString(),
              daysLate,
              client: inv.client
                ? `${inv.client.firstName} ${inv.client.lastName}`.trim()
                : undefined,
            },
            reminder: { id: r.id, name: r.name, channel: r.channel },
          });
        }
      }
    } else if (r.trigger === "CONTRACT_UNSIGNED") {
      // Fire for sent/viewed contracts that have been pending at least r.daysOffset days.
      for (const c of contracts) {
        const sentAt = c.sentAt ?? c.createdAt;
        const daysLate = daysBetween(now, new Date(sentAt));
        if (daysLate >= Math.max(0, r.daysOffset)) {
          out.push({
            type: r.trigger,
            target: {
              id: c.id,
              number: c.number,
              dueDate: new Date(sentAt).toISOString(),
              daysLate,
              client: c.client
                ? `${c.client.firstName} ${c.client.lastName}`.trim()
                : undefined,
            },
            reminder: { id: r.id, name: r.name, channel: r.channel },
          });
        }
      }
    } else if (r.trigger === "PROPOSAL_EXPIRING") {
      // Fire for proposals whose validUntil is at most r.daysOffset days away.
      for (const p of proposals) {
        if (!p.validUntil) continue;
        const daysLeft = daysBetween(new Date(p.validUntil), now);
        if (daysLeft >= 0 && daysLeft <= Math.max(0, r.daysOffset)) {
          out.push({
            type: r.trigger,
            target: {
              id: p.id,
              number: p.number,
              dueDate: new Date(p.validUntil).toISOString(),
              daysLate: -daysLeft,
              client: p.client
                ? `${p.client.firstName} ${p.client.lastName}`.trim()
                : undefined,
            },
            reminder: { id: r.id, name: r.name, channel: r.channel },
          });
        }
      }
    }
  }

  return ok(out);
}
