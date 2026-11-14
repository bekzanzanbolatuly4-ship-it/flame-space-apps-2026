import { z } from "zod";

const text = z.string().trim().min(1);
export const experimentIdSchema = z.enum(["flex", "bass-ii"]);
export const sourceSchema = z.object({
  id: text, title: text,
  url: z.url().refine((url) => new URL(url).protocol === "https:" && /(^|\.)nasa\.gov$/.test(new URL(url).hostname), "A primary NASA HTTPS source is required"),
  locator: text, verifiedOn: z.iso.date(),
}).strict();

export const quantityUnits = {
  "droplet-diameter": ["mm", "m"],
  "burning-rate-constant": ["mm²/s", "m²/s"],
  "heat-release-rate": ["W", "kW"],
  "equivalence-ratio": ["1"],
} as const;
export const measurementSchema = z.object({
  quantity: z.enum(["droplet-diameter", "burning-rate-constant", "heat-release-rate", "equivalence-ratio"]),
  value: z.number().finite().nonnegative(),
  unit: z.enum(["mm", "m", "mm²/s", "m²/s", "W", "kW", "1"]),
  kind: z.enum(["measured", "derived"]),
  statistic: z.enum(["single-run", "aggregate-mean"]),
  method: text,
  uncertainty: z.number().finite().nonnegative().nullable(),
  uncertaintyNote: text,
}).strict().refine((m) => (quantityUnits[m.quantity] as readonly string[]).includes(m.unit), "Quantity and unit must be compatible");

export const evidenceSchema = z.object({
  id: z.string().regex(/^(FLEX|BASS)-[A-Z0-9-]+$/),
  experimentId: experimentIdSchema, experimentName: text,
  title: text, objective: text, summary: text, finding: text,
  platform: text, apparatus: text, materialCategory: z.enum(["solid", "liquid-droplet"]), fuel: text,
  topics: z.array(text).min(1),
  conditions: z.array(z.object({ label: text, value: text, role: z.enum(["reported-condition", "protocol", "varied-parameter"]) }).strict()),
  context: z.object({ runId: text.nullable(), stage: z.enum(["initial", "extinction", "whole-run", "investigation"]), gravity: text,
    pressurePa: z.number().positive().nullable(), gasComposition: text.nullable(), flow: text.nullable(), support: text.nullable() }).strict(),
  evidenceType: z.enum(["experiment-description", "qualitative-finding", "measurement", "derived-result", "media-observation"]),
  measurement: measurementSchema.nullable(), source: sourceSchema,
  limitations: z.array(text).min(1), missingParameters: z.array(text),
  availability: z.enum(["document-only", "published-run-summary", "archival-media"]),
}).strict().superRefine((record, ctx) => {
  const numeric = record.evidenceType === "measurement" || record.evidenceType === "derived-result";
  if (numeric !== (record.measurement !== null)) ctx.addIssue({ code: "custom", message: "Numeric evidence requires an explicit measurement; qualitative evidence cannot carry one" });
  if (record.measurement && (record.evidenceType === "measurement") !== (record.measurement.kind === "measured")) ctx.addIssue({ code: "custom", message: "Measured and derived evidence must be distinguished" });
  if (record.measurement?.statistic === "single-run" && !record.context.runId) ctx.addIssue({ code: "custom", message: "A single-run value requires a run identifier" });
});
export const corpusSchema = z.array(evidenceSchema).min(1).refine((rows) => new Set(rows.map((r) => r.id)).size === rows.length, "Evidence identifiers must be unique");
export type Evidence = z.infer<typeof evidenceSchema>;
export type Measurement = z.infer<typeof measurementSchema>;
export type ExperimentId = z.infer<typeof experimentIdSchema>;
