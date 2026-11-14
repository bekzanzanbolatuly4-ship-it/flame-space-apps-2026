import { recordsForExperiment } from "./research/corpus.ts";
import type { ExperimentId } from "./research/schema.ts";
export type { ExperimentId } from "./research/schema.ts";

export type Experiment = {
  id: ExperimentId; name: string; subtitle: string; shortName: string;
  description: string; explore: string; insight: string; findings: string[];
  conditions: { label: string; value: string; note?: string }[];
  limitations: string[];
  sources: { label: string; href: string; detail: string }[];
  media: "footage" | "illustration";
};
function experiment(id: ExperimentId): Experiment {
  const records = recordsForExperiment(id);
  const overview = records.find((r) => r.evidenceType === "experiment-description")!;
  const conditionsRecord = records.find((r) => r.id === "FLEX-145-INITIAL") ?? overview;
  const sources = [...new Map(records.map((r) => [r.source.url, r.source])).values()];
  return {
    id, name: overview.experimentName, shortName: id === "flex" ? "FLEX" : "BASS-II",
    subtitle: id === "flex" ? "Liquid droplet combustion · ISS" : "Solid-fuel flame spread · ISS Microgravity Science Glovebox",
    description: overview.objective,
    explore: id === "flex" ? "In NASA’s recording, fuel continues to burn after the bright flame disappears. NASA describes this second stage as a cool flame." : overview.summary,
    insight: id === "flex" ? records.find((r) => r.id === "FLEX-COOL")!.summary : overview.finding,
    findings: records.filter((r) => r.evidenceType !== "experiment-description").map((r) => r.finding),
    conditions: conditionsRecord.conditions.map((c) => ({ label: c.label, value: c.value, note: `${conditionsRecord.id} · ${c.role}` })),
    limitations: [...new Set(records.flatMap((r) => r.limitations))],
    sources: sources.map((s) => ({ label: s.title, href: s.url, detail: s.locator })),
    media: id === "flex" ? "footage" : "illustration",
  };
}
export const experiments: Record<ExperimentId, Experiment> = { flex: experiment("flex"), "bass-ii": experiment("bass-ii") };
export function isExperimentId(value: unknown): value is ExperimentId { return value === "flex" || value === "bass-ii"; }
