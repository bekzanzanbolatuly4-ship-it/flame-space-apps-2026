import { z } from "zod";
import type { Evidence } from "./schema.ts";

export function groundedAnswerSchema(records: Evidence[]) {
  const ids = records.map((record) => record.id);
  if (!ids.length) throw new Error("Grounded generation requires retrieved evidence");
  return z.object({
    claims: z.array(z.object({
      text: z.string().trim().min(1).max(1200),
      kind: z.enum(["reported-fact", "interpretation"]),
      evidenceIds: z.array(z.enum(ids as [string, ...string[]])).min(1).max(6),
    }).strict()).min(1).max(6),
    limitations: z.array(z.string().trim().min(1).max(600)).min(1).max(6),
  }).strict();
}

export function validateGroundedAnswer(value: unknown, records: Evidence[]) {
  const answer = groundedAnswerSchema(records).parse(value);
  // IDs and links are rendered by the server, never accepted inside model prose.
  const recordIds = records.map((record) => record.id);
  for (const text of [...answer.claims.map((claim) => claim.text), ...answer.limitations]) {
    const inlineIds = text.match(/\b[A-Z]+(?:-[A-Z0-9]+)+\b/gi) ?? [];
    if (/https?:|www\.|\[[^\]]+\]/i.test(text) || inlineIds.some((id) => recordIds.includes(id))) throw new Error("Model-generated links or inline citation identifiers are not permitted");
  }
  for (const claim of answer.claims) {
    const citedRecords = records.filter((record) => claim.evidenceIds.includes(record.id));
    const supportedNumbers = new Set(citedRecords.flatMap((record) => (JSON.stringify({ finding: record.finding, conditions: record.conditions, measurement: record.measurement }).match(/\d+(?:\.\d+)?/g) ?? []).map(Number)));
    if ((claim.text.match(/\d+(?:\.\d+)?/g) ?? []).some((number) => !supportedNumbers.has(Number(number)))) throw new Error("A claim contains a number absent from its cited evidence");
  }
  // Limitation notes may cite slide/page numbers and source locators, so validate
  // those against the verified record metadata as well as its measured content.
  const availableNumbers = new Set(records.flatMap((record) => {
    const numbers = JSON.stringify({ finding: record.finding, conditions: record.conditions, measurement: record.measurement, limitations: record.limitations, locator: record.source.locator, runId: record.context.runId }).match(/\d+(?:\.\d+)?/g) ?? [];
    return numbers.map(Number);
  }));
  if (answer.limitations.some((limit) => (limit.match(/\d+(?:\.\d+)?/g) ?? []).some((number) => !availableNumbers.has(Number(number))))) throw new Error("A limitation contains an unsupported numerical value");
  const cited = new Set(answer.claims.flatMap((claim) => claim.evidenceIds));
  return { ...answer, sources: records.filter((record) => cited.has(record.id)).map((record) => ({ id: record.id, label: `${record.id} · ${record.source.title}`, href: record.source.url, locator: record.source.locator })) };
}
