"use client";

import { useMemo } from "react";
import { evaluateFlex145Droplet, FLEX_145_D2_PARAMETERS } from "@/lib/physics/droplet-d2";

export type MissionStage = "idle" | "predict" | "explore" | "explain" | "verify" | "complete";
export type MissionPrediction = "diameter" | "diameter-squared" | "envelope";
export type MissionCheck = "diameter" | "diameter-squared" | "envelope";

const duration = evaluateFlex145Droplet(0).modeledDurationSeconds;
const nasaSource = FLEX_145_D2_PARAMETERS.provenance[0].sourceUrl;
const predictions: { id: MissionPrediction; title: string; symbol: string }[] = [
  { id: "diameter", title: "Droplet diameter", symbol: "D(t)" },
  { id: "diameter-squared", title: "Squared droplet diameter", symbol: "D(t)²" },
  { id: "envelope", title: "Flame-envelope radius", symbol: "R flame" },
];

function modelCurve(kind: "diameter" | "diameter-squared", top: number) {
  const left = 34, right = 272, height = 38;
  const initial = evaluateFlex145Droplet(0).diameterM;
  const terminal = evaluateFlex145Droplet(duration).diameterM;
  const values = Array.from({ length: 41 }, (_, index) => {
    const time = duration * index / 40;
    const diameter = evaluateFlex145Droplet(time).diameterM;
    return kind === "diameter" ? diameter * 1000 : diameter * diameter * 1e6;
  });
  const first = kind === "diameter" ? initial * 1000 : initial * initial * 1e6;
  const last = kind === "diameter" ? terminal * 1000 : terminal * terminal * 1e6;
  return values.map((value, index) => {
    const x = left + (right - left) * index / (values.length - 1);
    const y = top + height * (first - value) / (first - last);
    return `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

function ModelCurves({ time }: { time: number }) {
  const paths = useMemo(() => ({ diameter: modelCurve("diameter", 19), squared: modelCurve("diameter-squared", 78) }), []);
  const progress = Math.min(1, Math.max(0, time / duration));
  const x = 34 + 238 * progress;
  const result = evaluateFlex145Droplet(time);
  const d = result.diameterM * 1000;
  return <div className="mission-chart-wrap" aria-live="off">
    <svg className="mission-chart" viewBox="0 0 280 142" role="img" aria-label="Conditional slide 10 scenario curves for droplet diameter and squared diameter, not observed time series">
      {[19, 38, 57, 78, 97, 116].map((y) => <line key={y} x1="34" x2="272" y1={y} y2={y} className="mission-gridline" />)}
      <path d={paths.diameter} className="mission-curve diameter-curve" />
      <path d={paths.squared} className="mission-curve squared-curve" />
      <line x1={x} x2={x} y1="16" y2="119" className="mission-cursor" />
      <text x="0" y="17" className="mission-axis-label">D · mm</text>
      <text x="0" y="77" className="mission-axis-label">D² · mm²</text>
      <text x="34" y="137" className="mission-axis-label">0 s</text>
      <text x="272" y="137" textAnchor="end" className="mission-axis-label">{duration.toFixed(2)} s</text>
    </svg>
    <div className="mission-chart-readout"><span>D(t) <strong>{d.toFixed(3)} mm</strong></span><span>D(t)² <strong>{(d * d).toFixed(3)} mm²</strong></span></div>
    <span className="mission-chart-note">CONDITIONAL SLIDE 10 SCENARIO · SOURCE CONFLICT UNRESOLVED · NOT OBSERVED TIME SERIES</span>
  </div>;
}

export function FlexLearningMission({
  stage, prediction, check, time, explored, visualMode,
  onStart, onClose, onPredict, onLockPrediction, onExplain, onBeginVerify, onCheck, onRetryCheck, onFinish, onReplay, onReturnToModel,
}: {
  stage: MissionStage;
  prediction: MissionPrediction | null;
  check: MissionCheck | null;
  time: number;
  explored: boolean;
  visualMode: "model" | "archive";
  onStart: () => void;
  onClose: () => void;
  onPredict: (value: MissionPrediction) => void;
  onLockPrediction: () => void;
  onExplain: () => void;
  onBeginVerify: () => void;
  onCheck: (value: MissionCheck) => void;
  onRetryCheck: () => void;
  onFinish: () => void;
  onReplay: () => void;
  onReturnToModel: () => void;
}) {
  if (stage === "idle") return <section className="mission-entry" aria-label="Optional learning mission">
    <div><span className="mission-kicker">OPTIONAL · FLEX-145</span><h3>Follow a droplet through the model.</h3></div>
    <button type="button" onClick={onStart}>Begin mission <span aria-hidden="true">↗</span></button>
  </section>;

  const step = { predict: 1, explore: 2, explain: 3, verify: 4, complete: 4 }[stage];
  return <section className="learning-mission" aria-label="Interactive FLEX learning mission">
    <header className="mission-heading"><div><span className="mission-kicker">MISSION · {String(step).padStart(2, "0")} / 04</span><h3>How does a fuel droplet change as it burns in microgravity?</h3></div><button type="button" className="mission-close" aria-label="Close learning mission" onClick={onClose}>×</button></header>

    {stage === "predict" && <div className="mission-stage-content"><span className="mission-stage-label">PREDICT</span><p>Which quantity follows a linear trend in the simplified model?</p><div className="mission-options">{predictions.map((item) => <button key={item.id} type="button" aria-pressed={prediction === item.id} className={prediction === item.id ? "selected" : ""} onClick={() => onPredict(item.id)}><span>{item.symbol}</span>{item.title}</button>)}</div><button type="button" className="mission-primary" disabled={!prediction} onClick={onLockPrediction}>Lock prediction</button></div>}

    {stage === "explore" && <div className="mission-stage-content"><span className="mission-stage-label">EXPLORE</span><p>{visualMode === "archive" ? "Return to the model to continue exploring." : "Scrub a conditional d²-law scenario using slide 10 values. The NASA source conflict is unresolved."}</p>{visualMode === "archive" && <button type="button" className="mission-primary" onClick={onReturnToModel}>Return to 3D model</button>}<ModelCurves time={time} /><button type="button" className="mission-primary" disabled={!explored || visualMode !== "model"} onClick={onExplain}>{explored ? "Reveal the relationship" : "Move through the model first"}</button></div>}

    {stage === "explain" && <div className="mission-stage-content"><span className="mission-stage-label">EXPLAIN</span><p className="mission-answer">The squared droplet diameter <strong>D(t)²</strong> decreases linearly: <code>D² = D₀² − Kt</code>.</p><p>Diameter itself follows a curve because it is the square root of that linear quantity.</p><p className="mission-envelope-note">Only droplet diameter follows this model. The 3D flame envelope is illustrative and does not change with it.</p><p className="mission-response">Your prediction: <strong>{predictions.find((item) => item.id === prediction)?.title ?? "No prediction recorded"}</strong></p><button type="button" className="mission-primary" onClick={onBeginVerify}>Check understanding</button></div>}

    {stage === "verify" && <div className="mission-stage-content"><span className="mission-stage-label">VERIFY</span><p>What decreases at a constant rate in this model?</p><div className="mission-options verify-options">{predictions.map((item) => <button key={item.id} type="button" aria-pressed={check === item.id} className={check === item.id ? "selected" : ""} onClick={() => onCheck(item.id)}>{item.title}</button>)}</div>{check && <div className={check === "diameter-squared" ? "mission-feedback correct" : "mission-feedback"} role="status">{check === "diameter-squared" ? "Correct. K is the constant slope of D² over this finite model interval." : "Not quite. The equation subtracts Kt from D₀², so check which quantity is squared."}<button type="button" onClick={onRetryCheck}>Try again</button></div>}{check === "diameter-squared" && <button type="button" className="mission-primary" onClick={onFinish}>Finish mission</button>}</div>}

    {stage === "complete" && <div className="mission-stage-content"><span className="mission-stage-label">MISSION COMPLETE</span><p>You predicted, explored and verified the model’s linear quantity.</p><p className="mission-envelope-note">Slide 10 reports these endpoints; slide 9 gives conflicting values and the source does not resolve them. Intermediate curves are conditional calculations, not measured time-series data.</p><a className="mission-source" href={nasaSource} target="_blank" rel="noreferrer">Open NASA FLEX-145 source ↗</a><a className="mission-source" href="#physics-limitations">Review model limitations ↓</a><button type="button" className="mission-primary" onClick={onReplay}>Replay mission</button></div>}

    {stage !== "complete" && <footer className="mission-footer"><button type="button" onClick={onClose}>Close mission</button><a href={nasaSource} target="_blank" rel="noreferrer">NASA FLEX-145 source ↗</a><a href="#physics-limitations">Model limits</a></footer>}
  </section>;
}
