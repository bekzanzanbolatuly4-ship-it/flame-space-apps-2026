"use client";

import type { Evidence } from "@/lib/research/schema";
import { flexTestRecordCount, FLEX_145_SOURCE_CONFLICT } from "@/lib/research/corpus";

type Props = {
  initial: Evidence;
  extinction: Evidence;
  rate: Evidence;
  modeledDurationSeconds: number;
  onBeginMission: () => void;
  onOpenDataLab: () => void;
  onAsk: () => void;
};

function value(record: Evidence) {
  const measurement = record.measurement;
  return measurement ? <>{measurement.value.toFixed(3)} <small>{measurement.unit}</small></> : <>Not reported</>;
}

export function FlexSciencePanel({ initial, extinction, rate, modeledDurationSeconds, onBeginMission, onOpenDataLab, onAsk }: Props) {
  const source = initial.source;
  const condition = (label: string) => initial.conditions.find((item) => item.label === label)?.value;

  return <section className="flex-science-panel" aria-label="FLEX-145 model and conflicting NASA source values">
    <header className="flex-science-heading">
      <span className="section-kicker">NASA FLEX-145 · SOURCE CONFLICT</span>
      <h2>One run.<br />Conflicting values<span className="panel-period">.</span></h2>
      <p>Slides 9 and 10 do not identify a correction or explain their differences.</p>
    </header>

    <ol className="science-connection" aria-label="NASA measurements to mathematical model to interactive reconstruction">
      <li><span>01</span> NASA measurements</li><li aria-hidden="true">→</li>
      <li><span>02</span> d²-law model</li><li aria-hidden="true">→</li>
      <li><span>03</span> Reconstruction</li>
    </ol>

    <div className="science-conflict-note" role="note" aria-label="Unresolved NASA source conflict">
      <strong>UNRESOLVED · SAME FLEX-145 TEST POINT</strong>
      <p>Slide 9 lists D₀ {FLEX_145_SOURCE_CONFLICT.slide9.initialDiameter}, Dext {FLEX_145_SOURCE_CONFLICT.slide9.extinctionDiameter}, K {FLEX_145_SOURCE_CONFLICT.slide9.burningRate}, and 75% CO₂ / 5% N₂. Slide 10’s FLEX-145 / C01M201 inset lists D₀ {FLEX_145_SOURCE_CONFLICT.slide10.initialDiameter}, Dext {FLEX_145_SOURCE_CONFLICT.slide10.extinctionDiameter}, Kavg {FLEX_145_SOURCE_CONFLICT.slide10.burningRate}, and N₂ 0.749 / CO₂ 0.050.</p>
      <p>The NASA presentation does not state which set supersedes the other. Displayed measurements retain slide 10’s reported values; the timeline and interval are conditional calculations from those disputed inputs, not a resolved experimental history.</p>
      <div><a href={`${FLEX_145_SOURCE_CONFLICT.sourceUrl}#page=9`} target="_blank" rel="noreferrer">Inspect slide 9 ↗</a><a href={`${FLEX_145_SOURCE_CONFLICT.sourceUrl}#page=10`} target="_blank" rel="noreferrer">Inspect slide 10 ↗</a></div>
    </div>

    <div className="flex-science-values">
      <div className="science-value">
        <span className="science-label">INITIAL DIAMETER · D₀</span>
        <strong>{value(initial)}</strong>
        <small className="science-provenance observed">SLIDE 10 REPORTED · CONFLICTED</small>
      </div>
      <div className="science-value">
        <span className="science-label">AVERAGE BURNING RATE · K</span>
        <strong>{value(rate)}</strong>
        <small className="science-provenance derived">SLIDE 10 REPORTED · DERIVED · CONFLICTED</small>
      </div>
      <div className="science-value">
        <span className="science-label">VISIBLE-FLAME EXTINCTION · Dext</span>
        <strong>{value(extinction)}</strong>
        <small className="science-provenance observed">SLIDE 10 REPORTED · CONFLICTED</small>
      </div>
      <div className="science-value model-interval">
        <span className="science-label">SLIDE 10 CONDITIONAL MODEL INTERVAL</span>
        <strong>{modeledDurationSeconds.toFixed(2)} <small>s</small></strong>
        <small className="science-provenance modeled">MODEL DERIVED · DISPUTED INPUTS · NOT A NASA TIME</small>
      </div>
    </div>

    <p className="flex-science-disclaimer">The droplet follows an explanatory d²-law model. The flame envelope is illustrative and not experimentally calibrated.</p>

    <div className="flex-run-conditions" aria-label="Slide 10 FLEX-145 conditions, disputed against slide 9">
      <span className="science-label">SLIDE 10 REPORTED CONDITIONS · SEE CONFLICT ABOVE</span>
      <p>{condition("Fuel")} <i /> {condition("Pressure")}</p>
      <p className="science-gas-composition">{condition("Gas composition")}</p>
    </div>

    <div className="flex-source-trace">
      <span className="science-label">NASA SOURCE · {source.id}</span>
      <strong>{source.title}</strong>
      <small>{source.locator}</small>
      <small className="science-source-caveat">Slide 9 also reports D₀ 3.38 mm, Dext 1.66 (unit not repeated), K 0.44 m²/s and the reversed N₂/CO₂ proportions. No correction is identified.</small>
    </div>

    <div className="flex-science-actions">
      <section className="science-mission-cta" aria-label="Optional learning mission">
        <button type="button" aria-label="Begin mission" className="science-action mission-action" onClick={onBeginMission}>BEGIN MISSION <span aria-hidden="true">↗</span></button>
      </section>
      <a className="science-action source-action" href={source.url} target="_blank" rel="noreferrer">INSPECT NASA SOURCE <span aria-hidden="true">↗</span></a>
      <button type="button" className="science-action datalab-action" onClick={onOpenDataLab}>EXPLORE NASA DATA LAB <span aria-hidden="true">↗</span></button>
      <small className="science-datalab-note">{flexTestRecordCount} test rows · separate NASA publication; FLEX-145 row identity is not established.</small>
    </div>

    <footer className="flex-science-footer">
      <span>ONE NASA RUN · NO RAW TIME SERIES</span>
      <button className="ask-button" type="button" onClick={onAsk}>Ask about this evidence</button>
    </footer>
  </section>;
}
