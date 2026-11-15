"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Pause, Play, RotateCcw } from "lucide-react";
import * as THREE from "three";
import { evaluateFlex145Droplet, evaluateFlex145WhatIf, FLEX_145_D2_PARAMETERS, type DropletD2Result, type Flex145WhatIfInputs } from "@/lib/physics/droplet-d2";

type Quality = "high" | "balanced" | "conservative";

// Illustrative display mapping only: 140 render units per metre; it does not set flame size.
const DROPLET_RENDER_UNITS_PER_METER = 140;
const INITIAL_DIAMETER_MM = FLEX_145_D2_PARAMETERS.initialDiameterM * 1000;
const EXTINCTION_DIAMETER_MM = FLEX_145_D2_PARAMETERS.extinctionDiameterM * 1000;
const EFFECTIVE_RATE_MM2_S = FLEX_145_D2_PARAMETERS.effectiveRateM2PerS * 1e6;

function displayRadius(diameterM: number) {
  return diameterM * DROPLET_RENDER_UNITS_PER_METER / 2;
}

const flameVertex = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  varying vec3 vLocal;
  varying vec3 vWorld;
  varying vec3 vNormalWorld;
  void main() {
    vec3 direction = normalize(position);
    float t = uTime * 0.55;
    float broadSwell = sin(dot(direction, vec3(2.1, 2.7, 1.8)) + t * 0.58)
      * cos(dot(direction, vec3(-1.4, 2.3, -2.1)) - t * 0.43);
    float softFold = sin(dot(direction, vec3(4.1, 2.8, 1.6)) + t * 0.72 + uProgress * 1.8);
    vec3 displaced = position * (1.0 + broadSwell * 0.11 + softFold * 0.055);
    vLocal = displaced;
    vec4 world = modelMatrix * vec4(displaced, 1.0);
    vWorld = world.xyz;
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const flameFragment = /* glsl */ `
  uniform float uTime;
  uniform float uLayer;
  uniform float uQuality;
  uniform float uProgress;
  varying vec3 vLocal;
  varying vec3 vWorld;
  varying vec3 vNormalWorld;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  void main() {
    vec3 p = normalize(vLocal);
    float t = uTime * 0.48;
    float broad = noise(p * 2.1 + vec3(t * 0.22, -t * 0.16, t * 0.19));
    float billow = uQuality > 0.5 ? noise(p * 3.6 + vec3(-t * 0.15, t * 0.2, -t * 0.14)) : broad;
    float flow = mix(broad, billow, 0.24);
    float latitude = 0.88 + 0.12 * sin(p.y * 2.7 + broad * 1.4 + t * 0.22);
    float density = 0.56 + 0.44 * smoothstep(0.22, 0.76, flow);
    float facing = abs(dot(normalize(vNormalWorld), normalize(cameraPosition - vWorld)));
    float reactionBoundary = 1.0 - smoothstep(0.01, 0.24, facing);
    float reaction = 0.64 + 0.36 * smoothstep(0.34, 0.76, flow);
    float pulse = 0.87 + 0.13 * sin(t * 1.7 + broad * 4.0 + uLayer);
    float burning = 1.0 - smoothstep(0.91, 1.0, uProgress);
    float layerStrength = uLayer < 0.5 ? 0.7 : uLayer < 1.5 ? 0.4 : 0.21;
    float ribbons = pow(0.5 + 0.5 * sin(p.y * 8.0 + p.x * 5.0 + broad * 9.0 - t * 1.6), 5.0);
    float diffuseWhisper = 0.19 * ribbons * smoothstep(0.25, 0.7, flow);
    float alpha = layerStrength * density * latitude * (0.55 * reactionBoundary + diffuseWhisper + 0.025 * reaction) * pulse * burning;
    float violet = smoothstep(0.72, 0.9, broad) * (uLayer > 1.5 ? 0.14 : 0.05);
    float emission = 0.68 + 0.32 * smoothstep(0.2, 0.82, flow);
    vec3 blue = mix(vec3(0.008, 0.036, 0.06), vec3(0.045, 0.42, 0.61), emission);
    vec3 color = mix(blue, vec3(0.25, 0.2, 0.38), violet);
    gl_FragColor = vec4(color, alpha);
  }
`;

const dropletVertex = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormalWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const dropletFragment = /* glsl */ `
  uniform float uProgress;
  uniform float uBurning;
  varying vec3 vWorld;
  varying vec3 vNormalWorld;
  void main() {
    vec3 n = normalize(vNormalWorld);
    vec3 v = normalize(cameraPosition - vWorld);
    vec3 l = normalize(vec3(0.35, 0.55, 3.2) - vWorld);
    float diffuse = max(dot(n, l), 0.0);
    float specular = pow(max(dot(reflect(-l, n), v), 0.0), 20.0);
    float fresnel = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    vec3 body = mix(vec3(0.022, 0.045, 0.052), vec3(0.1, 0.22, 0.24), clamp(diffuse * 0.68 + n.y * 0.12, 0.0, 0.78));
    float warmResponse = (0.035 + 0.42 * smoothstep(0.08, 0.76, uProgress)) * uBurning;
    float reflectedFlame = max(dot(n, normalize(vec3(-0.8, 0.16, 0.62))), 0.0);
    vec3 reflectedHeat = vec3(0.34, 0.115, 0.05) * warmResponse * (0.16 + 0.84 * reflectedFlame);
    vec3 color = body + reflectedHeat + vec3(0.48, 0.74, 0.8) * specular * 0.64 + vec3(0.035, 0.26, 0.34) * fresnel * 0.32;
    gl_FragColor = vec4(color, 1.0);
  }
`;

function FlameShell({ radius, layer, time, progress, quality, reducedMotion }: { radius: number; layer: number; time: RefObject<number>; progress: RefObject<number>; quality: Quality; reducedMotion: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  useFrame(() => {
    if (material.current) {
      material.current.uniforms.uTime.value = reducedMotion ? 0 : time.current;
      material.current.uniforms.uProgress.value = progress.current;
    }
  });
  const segments = quality === "high" ? 72 : quality === "balanced" ? 48 : 28;
  const scales = [1, 1.035, 1.075];
  return <mesh scale={[scales[layer], scales[layer] * 1.012, scales[layer] * 0.99]}>
    <sphereGeometry args={[radius, segments, Math.floor(segments * 0.72)]} />
    <shaderMaterial ref={material} vertexShader={flameVertex} fragmentShader={flameFragment} uniforms={{ uTime: { value: time.current }, uProgress: { value: progress.current }, uLayer: { value: layer }, uQuality: { value: quality === "high" ? 1 : 0 } }} transparent depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
  </mesh>;
}

function FlameObject({ quality, modelDiameterM, modelTime, modelProgress, reducedMotion }: { quality: Quality; modelDiameterM: RefObject<number>; modelTime: RefObject<number>; modelProgress: RefObject<number>; reducedMotion: boolean }) {
  const droplet = useRef<THREE.Group>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const rimMaterial = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (droplet.current) droplet.current.scale.setScalar(displayRadius(modelDiameterM.current));
    if (material.current) {
      material.current.uniforms.uProgress.value = modelProgress.current;
      material.current.uniforms.uBurning.value = modelProgress.current >= 1 ? 0 : 1;
    }
    if (rimMaterial.current) rimMaterial.current.opacity = 0.025 + 0.045 * modelProgress.current;
  });
  return <group>
    <FlameShell radius={0.87} layer={2} time={modelTime} progress={modelProgress} quality={quality} reducedMotion={reducedMotion} />
    <FlameShell radius={0.83} layer={1} time={modelTime} progress={modelProgress} quality={quality} reducedMotion={reducedMotion} />
    <FlameShell radius={0.79} layer={0} time={modelTime} progress={modelProgress} quality={quality} reducedMotion={reducedMotion} />
    <group ref={droplet}>
      <mesh>
        <sphereGeometry args={[1, quality === "high" ? 48 : 28, quality === "high" ? 36 : 20]} />
        <shaderMaterial ref={material} vertexShader={dropletVertex} fragmentShader={dropletFragment} uniforms={{ uProgress: { value: modelProgress.current }, uBurning: { value: modelProgress.current >= 1 ? 0 : 1 } }} />
      </mesh>
      <mesh scale={1.035}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshBasicMaterial ref={rimMaterial} color="#6eddfa" transparent opacity={0.025} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  </group>;
}

function PerformanceProbe({ quality, onQuality }: { quality: Quality; onQuality: (quality: Quality) => void }) {
  const frameTimes = useRef<number[]>([]);
  const current = useRef<Quality>(quality);
  const lastChange = useRef(0);
  const clock = useRef(0);
  useFrame((_, delta) => {
    current.current = quality;
    clock.current += delta;
    frameTimes.current.push(delta);
    if (frameTimes.current.length > 48) frameTimes.current.shift();
    if (frameTimes.current.length < 48 || clock.current - lastChange.current < 3) return;
    const mean = frameTimes.current.reduce((sum, frame) => sum + frame, 0) / frameTimes.current.length;
    let next = current.current;
    if (mean > 0.027) next = "conservative";
    else if (mean > 0.019 && current.current === "high") next = "balanced";
    else if (mean < 0.018 && current.current === "conservative") next = "balanced";
    else if (mean < 0.013 && current.current === "balanced") next = "high";
    if (next !== current.current) {
      current.current = next;
      lastChange.current = clock.current;
      onQuality(next);
    }
  });
  return null;
}

function getInitialQuality(): Quality {
  if (typeof navigator === "undefined") return "high";
  const device = navigator as Navigator & { deviceMemory?: number };
  return device.deviceMemory && device.deviceMemory <= 4 || navigator.hardwareConcurrency <= 4 ? "conservative" : "high";
}

export type FlexModelMode = "nasa" | "what-if";

function evaluateScenario(mode: FlexModelMode, seconds: number, inputs: Flex145WhatIfInputs) {
  return mode === "what-if" ? evaluateFlex145WhatIf(seconds, inputs) : evaluateFlex145Droplet(seconds);
}

const DEFAULT_WHAT_IF_INPUTS: Flex145WhatIfInputs = { initialDiameterMm: INITIAL_DIAMETER_MM, effectiveRateMm2PerS: EFFECTIVE_RATE_MM2_S };

export function FlexCombustionScene({ active = true, missionExploring = false, resetToken = 0, startToken = 0, modelMode = "nasa", whatIfInputs = DEFAULT_WHAT_IF_INPUTS, onModelActivity, onElapsedChange }: { active?: boolean; missionExploring?: boolean; resetToken?: number; startToken?: number; modelMode?: FlexModelMode; whatIfInputs?: Flex145WhatIfInputs; onModelActivity?: (seconds: number) => void; onElapsedChange?: (seconds: number) => void }) {
  const [quality, setQuality] = useState<Quality>("high");
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const elapsedRef = useRef(0);
  const timeRef = useRef(0);
  const progressRef = useRef(0);
  const diameterRef = useRef(evaluateScenario(modelMode, 0, whatIfInputs).diameterM);
  const modelConfigRef = useRef({ modelMode, whatIfInputs });
  const activeRef = useRef(active);
  const resetRef = useRef(resetToken);
  const startRef = useRef(startToken);
  const controls = useRef<OrbitControlsImpl>(null);

  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    modelConfigRef.current = { modelMode, whatIfInputs };
    const duration = evaluateScenario(modelMode, 0, whatIfInputs).modeledDurationSeconds;
    elapsedRef.current = Math.min(elapsedRef.current, duration);
    const current = evaluateScenario(modelMode, elapsedRef.current, whatIfInputs);
    diameterRef.current = current.diameterM;
    timeRef.current = elapsedRef.current;
    progressRef.current = current.normalizedProgress;
    setElapsed(elapsedRef.current);
    onElapsedChange?.(elapsedRef.current);
    if (current.status === "terminated") setPlaying(false);
  }, [modelMode, whatIfInputs, onElapsedChange]);

  useEffect(() => {
    if (resetRef.current === resetToken) return;
    resetRef.current = resetToken;
    const frame = window.requestAnimationFrame(() => {
      setPlaying(false);
      elapsedRef.current = 0;
      timeRef.current = 0;
      progressRef.current = 0;
      diameterRef.current = evaluateScenario(modelConfigRef.current.modelMode, 0, modelConfigRef.current.whatIfInputs).diameterM;
      setElapsed(0);
      onElapsedChange?.(0);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [resetToken, onElapsedChange]);

  useEffect(() => {
    if (startRef.current === startToken) return;
    startRef.current = startToken;
    const current = evaluateScenario(modelConfigRef.current.modelMode, elapsedRef.current, modelConfigRef.current.whatIfInputs);
    if (current.status === "terminated") {
      elapsedRef.current = 0;
      timeRef.current = 0;
      progressRef.current = 0;
      setElapsed(0);
      onElapsedChange?.(0);
    }
    setPlaying(true);
  }, [startToken, onElapsedChange]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous: number | null = null;
    let lastPublished = 0;
    const tick = (now: number) => {
      if (!activeRef.current) {
        setElapsed(elapsedRef.current);
        setPlaying(false);
        return;
      }
      if (previous !== null) {
        const config = modelConfigRef.current;
        const duration = evaluateScenario(config.modelMode, elapsedRef.current, config.whatIfInputs).modeledDurationSeconds;
        const next = Math.min(duration, elapsedRef.current + (now - previous) / 1000);
        elapsedRef.current = next;
        timeRef.current = next;
        const nextModel = evaluateScenario(config.modelMode, next, config.whatIfInputs);
        diameterRef.current = nextModel.diameterM;
        progressRef.current = nextModel.normalizedProgress;
        if (now - lastPublished >= 60 || next >= duration) {
          setElapsed(next);
          onElapsedChange?.(next);
          if (missionExploring) onModelActivity?.(next);
          lastPublished = now;
        }
        if (nextModel.status === "terminated") {
          setPlaying(false);
          return;
        }
      }
      previous = now;
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [playing, missionExploring, onModelActivity, onElapsedChange]);

  useEffect(() => {
    const qualityFrame = window.requestAnimationFrame(() => setQuality(getInitialQuality()));
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(motionPreference.matches);
    motionPreference.addEventListener("change", updateMotion);
    const updateVisibility = () => {
      const nextVisible = !document.hidden;
      setVisible(nextVisible);
      if (!nextVisible) {
        setElapsed(elapsedRef.current);
        setPlaying(false);
      }
    };
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      window.cancelAnimationFrame(qualityFrame);
      document.removeEventListener("visibilitychange", updateVisibility);
      motionPreference.removeEventListener("change", updateMotion);
    };
  }, []);

  const dpr: [number, number] = quality === "high" ? [1, 1.65] : quality === "balanced" ? [1, 1.2] : [0.8, 1];
  const modelState: DropletD2Result = evaluateScenario(modelMode, elapsed, whatIfInputs);
  const MODEL_DURATION = modelState.modeledDurationSeconds;
  const setModelTime = (seconds: number) => {
    const bounded = Math.max(0, Math.min(MODEL_DURATION, seconds));
    const endpointTolerance = Number.EPSILON * Math.max(1, MODEL_DURATION) * 8;
    const next = MODEL_DURATION - bounded <= endpointTolerance ? MODEL_DURATION : bounded;
    elapsedRef.current = next;
    timeRef.current = next;
    const nextModel = evaluateScenario(modelConfigRef.current.modelMode, next, modelConfigRef.current.whatIfInputs);
    diameterRef.current = nextModel.diameterM;
    progressRef.current = nextModel.normalizedProgress;
    setElapsed(next);
    onElapsedChange?.(next);
    if (missionExploring) onModelActivity?.(next);
    if (next >= MODEL_DURATION) setPlaying(false);
  };
  const diameterStatus = modelMode === "what-if"
    ? "MODEL DERIVED · HYPOTHETICAL INPUTS"
    : elapsed === 0 || modelState.status === "terminated"
      ? "SLIDE 10 SOURCE VALUE · CONFLICT UNRESOLVED"
      : "COMPUTED FROM DISPUTED SLIDE 10 INPUTS";

  return <div className="flex-model-canvas" aria-label="Three-dimensional model reconstruction of a suspended FLEX fuel droplet" data-model-diameter-m={modelState.diameterM} data-droplet-render-radius={displayRadius(modelState.diameterM)} data-model-status={modelState.status} data-visual-time={elapsed} data-model-progress={modelState.normalizedProgress}>
    <div className="flex-render-surface"><Canvas camera={{ position: [0.18, 0.12, 4.4], fov: 34 }} dpr={dpr} frameloop={active && visible && playing ? "always" : "demand"} gl={{ alpha: true, antialias: quality !== "conservative", powerPreference: "high-performance", depth: true, stencil: false }} fallback={<div className="webgl-unavailable">WebGL is unavailable on this device. The NASA archival FLEX footage remains available in the adjacent view.</div>} onCreated={({ gl }) => { gl.setClearColor("#05080d", 0); }}>
      <ambientLight intensity={0.34} />
      <pointLight position={[2.6, 1.8, 2.5]} color="#91dfff" intensity={4.2} distance={6} />
      <pointLight position={[-2.4, -0.7, -1.4]} color="#7258c5" intensity={2.2} distance={5} />
      <FlameObject quality={quality} modelDiameterM={diameterRef} modelTime={timeRef} modelProgress={progressRef} reducedMotion={reducedMotion} />
      <PerformanceProbe quality={quality} onQuality={setQuality} />
      <OrbitControls ref={controls} makeDefault enablePan={false} enableZoom minDistance={3.4} maxDistance={6.2} enableDamping dampingFactor={0.08} autoRotate={false} minPolarAngle={Math.PI * 0.24} maxPolarAngle={Math.PI * 0.76} />
    </Canvas></div>
    <div className="model-reconstruction-badge">MODEL RECONSTRUCTION</div>
    <button type="button" className="flex-reset-view" onClick={() => controls.current?.reset()}>Reset view</button>
    <div className="model-envelope-label">ILLUSTRATIVE FLAME · NOT A TEMPERATURE OR FLAME-RADIUS PREDICTION</div>
    <section className="d2-instrument" aria-label="Conditional FLEX-145 slide 10 scenario timeline">
      <div className="d2-reading"><div><span className="d2-kicker">CURRENT DROPLET DIAMETER</span><strong aria-live="off">{(modelState.diameterM * 1000).toFixed(3)} <small>mm</small></strong><span className="d2-value-status">{diameterStatus}</span></div>
        <div className="d2-model-time"><span className="d2-kicker">{modelMode === "what-if" ? "WHAT-IF MODEL TIME" : "CONDITIONAL SCENARIO TIME"}</span><strong>{elapsed.toFixed(2)} <small>/ {MODEL_DURATION.toFixed(2)} s</small></strong><span className="d2-value-status">{modelState.status === "terminated" ? "MODEL TERMINATED AT SLIDE 10 ENDPOINT" : modelMode === "what-if" ? "HYPOTHETICAL · d² LAW · DISPUTED ENDPOINT" : "CONDITIONAL · d² LAW · SOURCE CONFLICT"}</span></div>
      </div>
      <label className="d2-scrubber"><span className="sr-only">Scrub FLEX-145 model time</span><input aria-label="Scrub FLEX-145 model time" type="range" min="0" max={MODEL_DURATION} step="any" value={elapsed} onChange={(event) => setModelTime(Number(event.target.value))} style={{ "--d2-progress": `${modelState.normalizedProgress * 100}%`, caretColor: "transparent" } as CSSProperties} /></label>
      <div className="d2-controls"><div className="d2-buttons"><button type="button" aria-label={playing ? "Pause d squared model" : "Play d squared model"} disabled={!active || modelState.status === "terminated"} onClick={() => { if (playing) { setPlaying(false); setModelTime(elapsedRef.current); } else setPlaying(true); }}>{playing ? <Pause size={13} /> : <Play size={13} />}<span>{playing ? "Pause" : elapsed === 0 ? "Start Experiment" : "Play"}</span></button><button type="button" aria-label="Restart d squared model" onClick={() => { setPlaying(false); setModelTime(0); }}><RotateCcw size={12} /><span>Reset experiment</span></button></div>
        <span className="d2-rate">K <strong>{(modelMode === "what-if" ? whatIfInputs.effectiveRateMm2PerS : EFFECTIVE_RATE_MM2_S).toFixed(3)} mm²/s</strong> · {modelMode === "what-if" ? "HYPOTHETICAL" : "SLIDE 10 · CONFLICTED"}</span>
      </div>
      <details className="d2-provenance" id="physics-limitations"><summary>Source conflict & model limits</summary><p>{modelMode === "what-if" ? `Initial diameter ${whatIfInputs.initialDiameterMm.toFixed(2)} mm and K ${whatIfInputs.effectiveRateMm2PerS.toFixed(2)} mm²/s are hypothetical user inputs. The finite endpoint remains slide 10’s disputed 1.613 mm. Intermediate values are model calculations, not NASA observations.` : `This scenario uses only slide 10’s FLEX-145 / C01M201 annotations: D₀ ${INITIAL_DIAMETER_MM.toFixed(3)} mm, Dext ${EXTINCTION_DIAMETER_MM.toFixed(3)} mm, and Kavg ${EFFECTIVE_RATE_MM2_S.toFixed(3)} mm²/s. Slide 9 gives conflicting values and a different K unit; the source does not identify a correction. Intermediate diameters and interval are conditional calculations, not resolved FLEX-145 history or a measured NASA time series.`} The flame envelope remains illustrative and is not predicted by the d²-law.</p><div>{modelState.provenance.filter((source) => source.sourceUrl).map((source) => <a key={source.recordId} href={`${source.sourceUrl}${source.sourceUrl.includes("#") ? "" : "#page=10"}`} target="_blank" rel="noreferrer">SLIDE 10 {source.category.toUpperCase()} · {source.recordId} ↗</a>)}</div></details>
    </section>
  </div>;
}
