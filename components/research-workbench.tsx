"use client";

import { useRef, useState } from "react";
import { evidenceRecords } from "@/lib/research/corpus";
import { retrieveIndividualTests } from "@/lib/research/test-retrieval";
import { compareEvidence, searchEvidence } from "@/lib/research/engine";
import type { Evidence, ExperimentId } from "@/lib/research/schema";

export type ResearchState = { query: string; scope: "selected" | "all"; leftId: string; rightId: string };
export const initialResearchState: ResearchState = { query: "", scope: "selected", leftId: "FLEX-145-INITIAL", rightId: "FLEX-145-EXTINCTION" };

export function EvidenceCitation({ record }: { record: Evidence }) {
  return <a className="record-citation" href={record.source.url} target="_blank" rel="noreferrer">{record.id} ↗ <span>{record.source.locator}</span></a>;
}
export function ResearchWorkbench({ experimentId, detailed, state, onChange }: { experimentId: ExperimentId; detailed: boolean; state: ResearchState; onChange: (value: ResearchState) => void }) {
  const [briefOpen, setBriefOpen] = useState(false);
  const comparisonRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  function focusComparison() { comparisonRef.current?.scrollIntoView({ block: "start" }); comparisonRef.current?.focus({ preventScroll: true }); }
  const result = searchEvidence(state.query, { experimentId: state.scope === "selected" ? experimentId : undefined, compareTo: state.leftId });
  const comparisonRecords = [...evidenceRecords, ...retrieveIndividualTests(`${state.query} ${state.leftId} ${state.rightId}`)];
  const left = comparisonRecords.find((r) => r.id === state.leftId)!;
  const right = comparisonRecords.find((r) => r.id === state.rightId)!;
  const comparison = compareEvidence(left, right);
  return <div className="research-workbench">
    <label className="research-field"><span>Search verified evidence</span><input ref={searchRef} type="search" value={state.query} maxLength={600} placeholder="e.g. oxygen, methanol, heat release…" onChange={(event) => onChange({ ...state, query: event.target.value })} /></label>
    <label className="research-field"><span>Search scope</span><select value={state.scope} onChange={(event) => onChange({ ...state, scope: event.target.value as ResearchState["scope"] })}><option value="selected">Selected experiment · {experimentId.toUpperCase()}</option><option value="all">BASS-II + FLEX</option></select></label>
    <p className="research-caption">{evidenceRecords.length} curated records · deterministic retrieval. Scores express search relevance, never NASA credibility or fire risk.</p>
    <button type="button" className="brief-toggle" onClick={() => setBriefOpen((open) => !open)} disabled={state.query.trim().length < 3} aria-expanded={briefOpen}>{briefOpen ? "Close evidence brief" : "Build fire-safety evidence brief"}</button>
    {briefOpen && <FireSafetyBrief question={state.query} hits={result.hits.map((hit) => hit.record)} gaps={result.gaps} coverage={result.coverage} />}
    <button type="button" className="text-action" onClick={focusComparison}>Compare two records ↓</button>
    <div role="status" className="search-status">{state.query ? result.coverage === "insufficient" ? "Insufficient evidence · related records only" : result.coverage === "partial" ? "Partial coverage · review evidence gaps" : "Matching evidence found" : "Browse selected evidence"} · {result.hits.length} results</div>
    <details className="research-details" open={result.coverage === "insufficient"}><summary>Evidence gaps</summary><ul>{result.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul></details>
    <div className="research-results">{result.hits.map((hit) => <article className="research-record" key={hit.record.id}>
      <div className="record-heading"><h3>{hit.record.title}</h3><span aria-label={`Relevance score ${hit.score}`}>{hit.score}/100</span></div>
      <p>{detailed ? hit.record.finding : hit.record.summary}</p>
      <span className="record-kind">{hit.record.evidenceType.replaceAll("-", " ")} · {hit.record.availability.replaceAll("-", " ")}</span>
      <EvidenceCitation record={hit.record} />
      <details className="research-details"><summary>Why this rank?</summary><ul>{hit.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></details>
      <details className="research-details"><summary>Conditions & limitations</summary><p>{hit.record.platform} · {hit.record.fuel}</p><ul>{hit.record.conditions.map((c) => <li key={c.label}>{c.label}: {c.value} ({c.role})</li>)}{hit.record.limitations.map((limit) => <li key={limit}>{limit}</li>)}</ul>{hit.record.measurement && <p>{hit.record.measurement.kind}: {hit.record.measurement.value} {hit.record.measurement.unit}. {hit.record.measurement.method}. {hit.record.measurement.uncertaintyNote}</p>}</details>
      <button type="button" className="text-action" onClick={() => { onChange({ ...state, rightId: hit.record.id }); focusComparison(); }}>Use as comparison B ↘</button>
    </article>)}</div>
    <section ref={comparisonRef} tabIndex={-1} className="research-comparison" aria-label="Evidence comparison">
      <button type="button" className="text-action" onClick={() => searchRef.current?.focus()}>↑ Back to search</button>
      <h3>Compare evidence</h3><p className="research-caption">The initial and extinction records describe stages of one droplet, but the NASA slides conflict on their values. Quantitative comparison is withheld until the source is resolved.</p>
      {(["leftId", "rightId"] as const).map((side) => <label className="research-field" key={side}><span>Record {side === "leftId" ? "A" : "B"}</span><select aria-label={`Record ${side === "leftId" ? "A" : "B"}`} value={state[side]} onChange={(event) => onChange({ ...state, [side]: event.target.value })}>{comparisonRecords.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.title}</option>)}</select></label>)}
      <div className="comparison-result" role="status"><strong>{comparison.kind === "quantitative" ? "Within-run quantitative comparison" : "Qualitative comparison only"}</strong>{comparison.delta && <p className="comparison-value">{comparison.delta.value} {comparison.delta.unit}<span>Derived change · B − A</span></p>}<ul>{comparison.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>
      {comparison.context.map((context, index) => <div className="comparison-context" key={`${index}-${context.id}`}><strong>{index === 0 ? "A" : "B"} · {context.id}</strong><p>{context.material} · {context.fuel}<br />{context.apparatus}</p><p>{context.finding}</p><a href={context.source.url} target="_blank" rel="noreferrer">Original source ↗</a></div>)}
      <details className="research-details"><summary>Comparison limitations</summary><ul>{comparison.limitations.map((limit) => <li key={limit}>{limit}</li>)}</ul></details>
    </section>
  </div>;
}

function FireSafetyBrief({ question, hits, gaps, coverage }: { question: string; hits: Evidence[]; gaps: string[]; coverage: "supported" | "partial" | "insufficient" }) {
  const studies = hits.slice(0, 3);
  const missing = [...new Set(studies.flatMap((record) => record.missingParameters))];
  const comparisons = studies.length > 1 ? studies.slice(1).map((record) => compareEvidence(studies[0], record)) : [];
  const comparisonLimits = [...new Set(comparisons.flatMap((comparison) => comparison.reasons))];
  return <article className="evidence-brief" aria-label="Fire safety evidence brief">
    <header className="brief-header"><span className="brief-eyebrow">FLAME / RESEARCH BRIEF · NASA VERIFIED RECORDS</span><h2>Fire safety evidence brief</h2><p className="brief-question"><strong>Research question</strong>{question}</p>
      <p className="brief-lede">{coverage === "insufficient" ? "The available records do not establish a fire-safety conclusion for this question." : `The most relevant records address: ${studies[0]?.title ?? "no matching study"}. They do not establish an operational fire-safety threshold.`}</p>
    </header>
    <section><h3>Relevant NASA studies and findings</h3>{studies.length ? studies.map((record) => <div className="brief-study" key={record.id}><h4>{record.title}</h4><p>{record.finding}</p><p className="brief-meta">{record.experimentName} · {record.platform} · {record.apparatus}</p><EvidenceCitation record={record} /></div>) : <p>No verified studies match this question. Try terms such as methanol, extinction, oxygen, or heat release.</p>}</section>
    {studies.length > 0 && <section><h3>Conditions and comparability</h3><ul>{studies.flatMap((record) => record.conditions.map((condition) => <li key={`${record.id}-${condition.label}`}><strong>{record.id} · {condition.label}:</strong> {condition.value} <span>({condition.role})</span></li>))}{comparisonLimits.map((limit) => <li key={limit}>{limit}</li>)}</ul>{studies.length === 1 && <p>One study is available; cross-study comparability is not established.</p>}</section>}
    <section><h3>Evidence gaps and uncertainty</h3><ul>{gaps.map((gap) => <li key={gap}>{gap}</li>)}{studies.flatMap((record) => record.limitations.map((limit) => <li key={`${record.id}-${limit}`}>{record.id}: {limit}</li>))}</ul></section>
    <section className="brief-implications"><h3>Implications for further research · interpretation</h3><p>{missing.length ? `Further work could measure the unavailable parameters: ${missing.join(", ")}.` : "The available evidence gaps should guide follow-up measurements and study design."} This is a research implication, not a proven safety conclusion. The records do not establish an operational safety threshold.</p></section>
    <footer>All findings above are reported in the linked records. Interpretations and research implications are labeled separately.</footer>
  </article>;
}
