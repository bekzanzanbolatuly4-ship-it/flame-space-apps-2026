import { z } from "zod";
import { evidenceRecords } from "@/lib/research/corpus";
import { compareEvidence, searchEvidence } from "@/lib/research/engine";
import { experimentIdSchema } from "@/lib/research/schema";

const querySchema = z.object({ q: z.string().max(600).default(""), experiment: experimentIdSchema.optional(), compareTo: z.string().max(80).optional() });
export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "Invalid search parameters." }, { status: 400 });
  if (parsed.data.compareTo && !evidenceRecords.some((r) => r.id === parsed.data.compareTo)) return Response.json({ error: "Unknown reference evidence." }, { status: 400 });
  return Response.json(searchEvidence(parsed.data.q, { experimentId: parsed.data.experiment, compareTo: parsed.data.compareTo }));
}
export async function POST(request: Request) {
  let raw: string;
  try { raw = await request.text(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (raw.length > 2048) return Response.json({ error: "Request too large." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = z.object({ leftId: z.string(), rightId: z.string() }).strict().safeParse(body);
  if (!parsed.success) return Response.json({ error: "Two evidence IDs are required." }, { status: 400 });
  const left = evidenceRecords.find((r) => r.id === parsed.data.leftId), right = evidenceRecords.find((r) => r.id === parsed.data.rightId);
  if (!left || !right) return Response.json({ error: "Unknown evidence ID." }, { status: 400 });
  return Response.json(compareEvidence(left, right));
}
