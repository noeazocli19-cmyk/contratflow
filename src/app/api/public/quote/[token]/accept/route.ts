import { NextRequest } from "next/server";
import { ok, err, notify, timeline } from "@/lib/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const quote = await db.quote.findUnique({
    where: { publicToken: token },
    include: { client: true },
  });
  if (!quote) return err("Devis introuvable", 404);

  const body = await req.json();
  const { decision, message } = body || {};
  if (!decision || !["ACCEPT", "REFUSE"].includes(decision)) {
    return err("decision doit être 'ACCEPT' ou 'REFUSE'", 400);
  }

  if (decision === "ACCEPT") {
    const updated = await db.quote.update({
      where: { id: quote.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
    });

    await notify(
      quote.organizationId,
      "QUOTE_ACCEPTED",
      "Devis accepté",
      `Le client a accepté le devis ${quote.number}${message ? " : " + message : ""}.`,
      "quotes",
    );
    await timeline(
      quote.clientId,
      "QUOTE_ACCEPTED",
      `Devis ${quote.number} accepté`,
    );

    return ok({ quote: updated });
  } else {
    const updated = await db.quote.update({
      where: { id: quote.id },
      data: {
        status: "REFUSED",
        refusedAt: new Date(),
      },
    });

    await notify(
      quote.organizationId,
      "QUOTE_REFUSED",
      "Devis refusé",
      `Le client a refusé le devis ${quote.number}${message ? " : " + message : ""}.`,
      "quotes",
    );
    await timeline(
      quote.clientId,
      "QUOTE_REFUSED",
      `Devis ${quote.number} refusé`,
    );

    return ok({ quote: updated });
  }
}
