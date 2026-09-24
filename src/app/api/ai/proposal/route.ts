// AI Proposal Generator — uses z-ai-web-dev-sdk LLM to draft a professional proposal
// based on a brief description + client info.
//
// Auth required. Body: {
//   clientId: string,
//   brief: string,        // what the client wants
//   budget?: number,      // optional target budget
//   timeline?: string,    // optional target timeline
// }
// Returns: { title, problem, solution, deliverables, timeline, amount, conditions }

import { NextRequest } from "next/server";
import { getCtx, ok, err } from "@/lib/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return err("Non authentifié", 401);

  // Check plan limits (only PRO/AGENCY have aiAssistant)
  const sub = await db.subscription.findUnique({ where: { organizationId: ctx.user.organizationId } });
  if (!sub || (sub.plan !== "PRO" && sub.plan !== "AGENCY")) {
    return err("L'assistant IA est disponible sur le plan Pro. Passez à Pro pour l'utiliser.", 402);
  }

  const body = await req.json().catch(() => null);
  if (!body) return err("Requête invalide", 400);

  const { clientId, brief, budget, timeline } = body as {
    clientId?: string;
    brief?: string;
    budget?: number;
    timeline?: string;
  };

  if (!clientId || !brief) return err("clientId et brief sont requis", 400);

  // Verify client belongs to tenant
  const client = await db.client.findFirst({
    where: { id: clientId, organizationId: ctx.user.organizationId },
  });
  if (!client) return err("Client introuvable", 404);

  // Build the prompt
  const prompt = `Tu es un consultant freelance expérimenté. Rédige une proposition commerciale professionnelle pour le client suivant.

CLIENT
- Nom : ${client.firstName} ${client.lastName}
- Entreprise : ${client.company || "—"}
- Email : ${client.email || "—"}
- Téléphone : ${client.phone || "—"}

BESOIN EXPIMÉ PAR LE CLIENT
${brief}

${budget ? `BUDGET CIBLE : ${budget} FCFA` : ""}
${timeline ? `DÉLAI SOUHAITÉ : ${timeline}` : ""}

Réponds en JSON STRICT avec ce schéma (et RIEN d'autre, pas de markdown, pas de \`\`\`json) :
{
  "title": "Titre court de la proposition",
  "problem": "Description du problème du client (2-3 paragraphes)",
  "solution": "Notre solution proposée (2-3 paragraphes)",
  "deliverables": "Liste de livrables séparés par des retours à la ligne, préfixés par -",
  "timeline": "Planning en semaines",
  "amount": <nombre entier en FCFA>,
  "conditions": "Conditions de paiement et de validation"
}`;

  try {
    // Use the z-ai-web-dev-sdk (server-side only)
    const { ZAI } = await import("z-ai-web-dev-sdk");
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: "Tu es un assistant expert en propositions commerciales freelances pour l'Afrique de l'Ouest. Tu réponds en français et en JSON strict." },
        { role: "user", content: prompt },
      ],
    });
    const content = completion.choices?.[0]?.message?.content || "";

    // Try to parse the JSON from the response
    let parsed: Record<string, unknown>;
    try {
      // Strip markdown code fences if present
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: extract {...} block
      const match = content.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else return err("Réponse IA invalide", 502);
    }

    return ok({
      title: String(parsed.title || ""),
      problem: String(parsed.problem || ""),
      solution: String(parsed.solution || ""),
      deliverables: String(parsed.deliverables || ""),
      timeline: String(parsed.timeline || ""),
      amount: Number(parsed.amount || 0),
      conditions: String(parsed.conditions || ""),
    });
  } catch (e) {
    console.error("AI proposal error:", e);
    return err("Erreur de l'assistant IA. Réessaye.", 502);
  }
}
