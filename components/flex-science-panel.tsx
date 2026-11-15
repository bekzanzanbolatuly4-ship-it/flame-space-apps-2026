"use client";

import type { Evidence } from "@/lib/research/schema";
import { flexTestRecordCount, FLEX_145_SOURCE_CONFLICT } from "@/lib/research/corpus";
import { evaluateFlex145WhatIf, type Flex145WhatIfInputs } from "@/lib/physics/droplet-d2";
import type { FlexModelMode } from "@/components/flex-combustion-scene";

type Props = {
  initial: Evidence;
  extinction: Evidence;
  rate: Evidence;
  modeledDurationSeconds: number;
  modelMode: FlexModelMode;
  whatIfInputs: Flex145WhatIfInputs;
  elapsedSeconds: number;
  onModelModeChange: (mode: FlexModelMode) => void;
  onWhatIfChange: (inputs: Flex145WhatIfInputs) => void;
  onStartExperiment: () => void;
  onResetReference: () => void;
  onBeginMission: () => void;
  onOpenDataLab: () => void;
  onAsk: () => void;
};

function value(record: Evidence) {
  const measurement = record.measurement;
  return measurement ? <>{measurement.value.toFixed(3)} <small>{measurement.unit}</small></> : <>Not reported</>;
}

function WhatIfGraph({ inputs, elapsedSeconds }: { inputs: Flex145WhatIfInputs; elapsedSeconds: number }) {
  const duration = evaluateFlex145WhatIf(0, inputs).modeledDurationSeconds;
  const points = Array.from({ length: 25 }, (_, index) => evaluateFlex145WhatIf(duration * index / 24, inputs));
  const diameterAt = (index: number) => {
    const value = points[index].diameterM * 1000;
    const low = 1.613;
    const high = inputs.initialDiameterMm;
    return 26 + (1 - (value - low) / Math.max(0.001, high - low)) * 18;
  };
  const squareAt = (index: number) => {
    const value = points[index].diameterSquaredM2 * 1e6;
    const low = 1.613 ** 2;
    const high = inputs.initialDiameterMm ** 2;
    return 66 + (1 - (value - low) / Math.max(0.001, high - low)) * 18;
  };
  const path = (yAt: (index: number) => number) => points.map((_, index) => `${index === 0 ? "M" : "L"}${(12 + index * 9.8).toFixed(1)},${yAt(index).toFixed(1)}`).join(" ");
  const cursorX = 12 + Math.max(0, Math.min(1, elapsedSeconds / duration)) * 235;
  return <div className="what-if-chart-wrap">
    <div className="what-if-chart-title">MODEL-DERIVED CURVES <span>NOT NASA TIME SERIES</span></div>
    <svg className="what-if-chart" viewBox="0 0 260 101" role="img" aria-label="Model-derived hypothetical droplet diameter and squared diameter curves">
      <path d="M12 47H247M12 87H247" className="what-if-grid" />
      <path d={path(diameterAt)} className="what-if-diameter" />
      <path d={path(squareAt)} className="what-if-square" />
      <path d={`M${cursorX.toFixed(1)} 17V91`} className="what-if-cursor" />
      <text x="12" y="19" className="what-if-axis">D(t) · mm</text>
      <text x="12" y="60" className="what-if-axis">D(t)² · mm²</text>
      <text x="12" y="99" className="what-if-axis">0 s</text>
      <text x="247" y="99" textAnchor="end" className="what-if-axis">{duration.toFixed(1)} s</text>
    </svg>
  </div>;
}

export function FlexSciencePanel({ initial, extinction, rate, modeledDurationSeconds, modelMode, whatIfInputs, elapsedSeconds, onModelModeChange, onWhatIfChange, onStartExperiment, onResetReference, onBeginMission, onOpenDataLab, onAsk }: Props) {
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

    <section className="flex-interaction-controls" aria-label="FLEX experiment controls">
      <div className="flex-mode-heading"><span className="science-label">EXPERIMENT CONTROLS</span><div role="group" aria-label="FLEX model mode" className="flex-mode-switch">
        <button type="button" aria-pressed={modelMode === "nasa"} onClick={() => onModelModeChange("nasa")}>NASA experiment</button>
        <button type="button" aria-pressed={modelMode === "what-if"} onClick={() => onModelModeChange("what-if")}>What-if model</button>
      </div></div>
      {modelMode === "nasa" ? <div className="flex-start-block">
        <button type="button" className="science-action start-experiment-action" onClick={onStartExperiment}>START EXPERIMENT <span aria-hidden="true">▶</span></button>
        <span>FLEX-145 slide-10-only conditional scenario · source conflict remains unresolved</span>
        <small>Drag to rotate · scroll or pinch to zoom · scrub the timeline</small>
      </div> : <div className="what-if-controls">
        <p>HYPOTHETICAL PARAMETERS · NOT NASA MEASUREMENTS</p>
        <label><span>Initial diameter <strong>{whatIfInputs.initialDiameterMm.toFixed(2)} mm</strong></span><input aria-label="Hypothetical initial droplet diameter" type="range" min="2" max="4.5" step="0.05" value={whatIfInputs.initialDiameterMm} onChange={(event) => onWhatIfChange({ ...whatIfInputs, initialDiameterMm: Number(event.target.value) })} /></label>
        <label><span>Effective d² rate <strong>{whatIfInputs.effectiveRateMm2PerS.toFixed(2)} mm²/s</strong></span><input aria-label="Hypothetical effective burning rate" type="range" min="0.25" max="0.9" step="0.01" value={whatIfInputs.effectiveRateMm2PerS} onChange={(event) => onWhatIfChange({ ...whatIfInputs, effectiveRateMm2PerS: Number(event.target.value) })} /></label>
        <div className="what-if-derived"><span>MODEL INTERVAL</span><strong>{modeledDurationSeconds.toFixed(2)} s</strong><span>Finite endpoint fixed to disputed slide 10 Dext · 1.613 mm</span></div>
        <WhatIfGraph inputs={whatIfInputs} elapsedSeconds={elapsedSeconds} />
        <button type="button" className="what-if-reset" onClick={onResetReference}>Reset to NASA reference inputs</button>
      </div>}
    </section>

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
