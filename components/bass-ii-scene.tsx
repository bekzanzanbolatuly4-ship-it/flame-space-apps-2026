"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { Eye, EyeOff, Pause, Play, RotateCcw } from "lucide-react";

const NASA_BASS_SOURCE = "https://ntrs.nasa.gov/citations/20210011385";
const GEOMETRIES = [
  { label: "6.35 mm rod", diameter: 6.35 },
  { label: "9.525 mm rod", diameter: 9.525 },
  { label: "12.7 mm rod", diameter: 12.7 },
] as const;
const DEMO_DURATION = 18;

function Specimen({ diameter }: { diameter: number }) {
  const radius = diameter / 57.15 * 1.1; // One scale for all reported dimensions.
  return <group>
    <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, 2.2 - 2 * radius, 64, 1, false]} />
      <meshStandardMaterial color="#58534b" roughness={0.86} metalness={0} />
    </mesh>
    <mesh position={[-1.1 + radius, 0, 0]} castShadow><sphereGeometry args={[radius, 32, 24]} /><meshStandardMaterial color="#4d4942" roughness={0.88} metalness={0} /></mesh>
    <mesh position={[1.1 - radius, 0, 0]} castShadow><sphereGeometry args={[radius, 32, 24]} /><meshStandardMaterial color="#4d4942" roughness={0.88} metalness={0} /></mesh>
  </group>;
}

const flameVertex = /* glsl */`
  uniform float uTime;
  uniform float uProgress;
  uniform float uFlow;
  varying vec3 vPosition;
  varying float vWave;
  void main() {
    vPosition = position;
    float wave = sin(position.x * 8.0 + uTime * 3.2) * 0.035 + sin(position.x * 15.0 - uTime * 2.1) * 0.018;
    vWave = wave;
    vec3 p = position;
    float fold = sin(position.z * 9.0 + position.x * 7.0 - uTime * 2.7);
    p.y *= 1.0 + wave * 5.0 + fold * 0.16;
    p.z *= 1.0 + wave * 3.0 + sin(position.y * 8.0 + uTime * 2.0) * 0.15;
    p.x += uFlow * (p.y + 1.0) * 0.14;
    p.y *= 1.0 - abs(uFlow) * 0.2;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const flameFragment = /* glsl */`
  uniform float uTime;
  uniform float uProgress;
  uniform float uActive;
  varying vec3 vPosition;
  varying float vWave;
  void main() {
    float front = -0.92 + 1.84 * uProgress;
    float localX = vPosition.x;
    float behind = 1.0 - smoothstep(front - 0.14, front + 0.025, localX);
    float frontZone = exp(-pow((localX - front) * 5.5, 2.0));
    float edge = 1.0 - smoothstep(0.0, 1.0, abs(vPosition.y) * 0.78 + abs(vPosition.z) * 0.8);
    float flicker = 0.84 + 0.16 * sin(uTime * 5.5 + localX * 11.0 + vWave * 20.0);
    float fade = 1.0 - smoothstep(0.91, 1.0, uProgress);
    float alpha = (0.11 * behind + 0.72 * frontZone) * edge * flicker * uActive * fade;
    if (alpha < 0.012) discard;
    vec3 color = mix(vec3(0.95, 0.22, 0.055), vec3(1.0, 0.72, 0.28), smoothstep(0.18, 0.82, frontZone));
    gl_FragColor = vec4(color, alpha);
  }
`;

function FlameSpread({ progress, time, active, flow }: { progress: number; time: number; active: boolean; flow: number }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  useFrame(() => {
    const shader = material.current;
    if (!shader) return;
    shader.uniforms.uTime.value = time;
    shader.uniforms.uFlow.value = flow;
    shader.uniforms.uProgress.value = progress;
    shader.uniforms.uActive.value = active ? 1 : 0;
  });
  return <group position={[0, 0.23, 0]}>
    <mesh scale={[1.1, 0.36, 0.32]}>
      <sphereGeometry args={[1, 48, 32]} />
      <shaderMaterial ref={material} vertexShader={flameVertex} fragmentShader={flameFragment} uniforms={{ uFlow: { value: flow }, uTime: { value: time }, uProgress: { value: progress }, uActive: { value: active ? 1 : 0 } }} transparent depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
    </mesh>
    {active && progress < 0.995 && <pointLight position={[-0.92 + 1.84 * progress, 0.12, 0]} color="#ff743d" intensity={0.8} distance={0.9} />}
  </group>;
}

function Airflow({ direction, visible }: { direction: "opposed" | "concurrent"; visible: boolean }) {
  if (!visible) return null;
  const sign = direction === "opposed" ? -1 : 1;
  return <group position={[0, 0.73, 0]}>
    {[-0.42, 0, 0.42].map((z) => <group key={z} position={[0, 0, z]} scale={[sign, 1, 1]}>
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.006, 0.006, 3.3, 6]} /><meshBasicMaterial color="#8dddf2" transparent opacity={0.23} /></mesh>
      {[-1.28, -0.32, 0.64].map((x) => <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.055, 0.16, 8]} /><meshBasicMaterial color="#a5e8f7" transparent opacity={0.72} /></mesh>)}
    </group>)}
  </group>;
}

function SceneContents({ diameter, progress, time, playing, showAirflow, direction, controls, onQuality, reducedMotion, intensity }: { diameter: number; progress: number; time: number; playing: boolean; showAirflow: boolean; direction: "opposed" | "concurrent"; controls: RefObject<OrbitControlsImpl | null>; onQuality: (tier: Quality) => void; reducedMotion: boolean; intensity: number }) {
  return <>
    <color attach="background" args={["#080d16"]} />
    <ambientLight intensity={0.7} />
    <directionalLight position={[2, 4, 4]} intensity={2.4} color="#d8e7ef" />
    <directionalLight position={[-3, 2, -2]} intensity={1.1} color="#668daf" />
    <Specimen diameter={diameter} />
    <FlameSpread flow={intensity * (direction === "opposed" ? -1 : 1)} progress={progress} time={reducedMotion ? 0 : time} active={progress < 1} />
    <Airflow direction={direction} visible={showAirflow} />
    <OrbitControls ref={controls} makeDefault enablePan={false} enableZoom minDistance={2.6} maxDistance={7} enableDamping dampingFactor={0.08} autoRotate={false} />
    <FrameQualityProbe onQuality={onQuality} />
    {playing && <pointLight position={[0, 1, 0]} color="#4a1720" intensity={0.25} distance={3} />}
  </>;
}

type Quality = "high" | "balanced" | "conservative";
function FrameQualityProbe({ onQuality }: { onQuality: (tier: Quality) => void }) {
  const samples = useRef<number[]>([]);
  const elapsed = useRef(0);
  const lastChange = useRef(0);
  const tier = useRef<Quality>("high");
  useFrame((_, delta) => {
    elapsed.current += delta; samples.current.push(delta);
    if (samples.current.length > 45) samples.current.shift();
    if (samples.current.length < 45 || elapsed.current - lastChange.current < 3) return;
    const mean = samples.current.reduce((sum, value) => sum + value, 0) / samples.current.length;
    const next = mean > 0.028 ? "conservative" : mean > 0.02 ? "balanced" : mean < 0.014 && tier.current !== "high" ? "high" : tier.current;
    if (next !== tier.current) { tier.current = next; lastChange.current = elapsed.current; onQuality(next); }
  });
  return null;
}

export function BassIIScene({ active = true, startToken = 0 }: { active?: boolean; startToken?: number }) {
  const [diameter, setDiameter] = useState<number>(GEOMETRIES[1].diameter);
  const [direction, setDirection] = useState<"opposed" | "concurrent">("opposed");
  const [intensity, setIntensity] = useState(0.4);
  const [showAirflow, setShowAirflow] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(true);
  const [quality, setQuality] = useState<Quality>(() => typeof navigator !== "undefined" && (navigator.hardwareConcurrency <= 4 || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4) ? "conservative" : "high");
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const controls = useRef<OrbitControlsImpl>(null);
  const elapsedRef = useRef(0);
  const startRef = useRef(startToken);
  const activeRef = useRef(active);

  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => {
    if (startRef.current === startToken) return;
    startRef.current = startToken;
    if (elapsedRef.current >= DEMO_DURATION) { elapsedRef.current = 0; setElapsed(0); }
    setPlaying(true);
  }, [startToken]);
  useEffect(() => {
    const update = () => { setVisible(!document.hidden); if (document.hidden) setPlaying(false); };
    update(); document.addEventListener("visibilitychange", update);
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(motionPreference.matches);
    motionPreference.addEventListener("change", updateMotion);
    return () => { document.removeEventListener("visibilitychange", update); motionPreference.removeEventListener("change", updateMotion); };
  }, []);
  useEffect(() => {
    if (!playing || !visible) return;
    let frame = 0; let previous = 0;
    const tick = (now: number) => {
      if (!activeRef.current) { setPlaying(false); return; }
      if (!previous) previous = now;
      const next = Math.min(DEMO_DURATION, elapsedRef.current + (now - previous) / 1000);
      previous = now; elapsedRef.current = next; setElapsed(next);
      if (next >= DEMO_DURATION) { setPlaying(false); return; }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [playing, visible]);
  const progress = elapsed / DEMO_DURATION;
  const scrub = (value: number) => { const bounded = Math.max(0, Math.min(DEMO_DURATION, value)); elapsedRef.current = bounded; setElapsed(bounded); if (bounded >= DEMO_DURATION) setPlaying(false); };
  const reset = () => { setPlaying(false); scrub(0); setDiameter(GEOMETRIES[1].diameter); setDirection("opposed"); setShowAirflow(true); setIntensity(0.4); };

  return <div className="bass-scene" data-bass-time={elapsed.toFixed(3)} data-bass-progress={progress.toFixed(4)} data-bass-diameter={diameter} data-bass-playing={playing}>
    <Canvas camera={{ position: [2.7, 2.25, 3.65], fov: 38 }} dpr={quality === "high" ? [1, 1.5] : quality === "balanced" ? [0.85, 1.15] : [0.75, 0.9]} frameloop={active && visible && playing ? "always" : "demand"} gl={{ alpha: false, antialias: quality !== "conservative", powerPreference: "high-performance" }} fallback={<div className="webgl-unavailable">Interactive 3D needs WebGL on this device.</div>}>
      <SceneContents diameter={diameter} progress={progress} time={elapsed} playing={playing} showAirflow={showAirflow} direction={direction} controls={controls} onQuality={setQuality} reducedMotion={reducedMotion} intensity={intensity} />
    </Canvas>
    <div className="bass-view-controls" aria-label="BASS-II visualization controls">
      <div className="bass-control-line"><span className="bass-visual-label">ILLUSTRATIVE 3D RECONSTRUCTION</span><button type="button" className="flex-reset-view" onClick={() => controls.current?.reset()}>Reset view</button></div>
      <div className="bass-control-line bass-select-controls">
        <label><span>NASA ROD SERIES · DIAMETER</span><select aria-label="NASA BASS-II rod diameter" value={diameter} onChange={(event) => setDiameter(Number(event.target.value))}>{GEOMETRIES.map((item) => <option key={item.diameter} value={item.diameter}>{item.label}</option>)}</select></label>
        <label><span>FLOW VISUALIZATION · DIAGRAMMATIC</span><select aria-label="Diagrammatic airflow direction" value={direction} onChange={(event) => setDirection(event.target.value as "opposed" | "concurrent")}><option value="opposed">Opposed to spread</option><option value="concurrent">Along spread</option></select></label>
        <button type="button" className="bass-airflow-toggle" aria-pressed={showAirflow} onClick={() => setShowAirflow((value) => !value)}>{showAirflow ? <Eye size={13} /> : <EyeOff size={13} />} Airflow {showAirflow ? "on" : "off"}</button>
      </div>
      <label className="bass-flow-strength">Illustrative airflow · {intensity < 0.4 ? "gentle" : intensity < 0.75 ? "moderate" : "strong"}<input aria-label="Illustrative airflow intensity" type="range" min="0" max="1" step="0.01" value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} /><small>Shape response only · no predicted spread rate</small></label>
      <div className="bass-provenance-line"><span>PMMA RODS · 57.15 mm LENGTH · GEOMETRY SCALED FOR DISPLAY</span><a href={NASA_BASS_SOURCE} target="_blank" rel="noreferrer">NASA SOURCE · PP. 46–47 ↗</a></div>
    </div>
    <div className="bass-timeline" aria-label="BASS-II illustrative timeline" data-testid="bass-timeline">
      <div className="bass-timeline-top"><strong>{elapsed <= 0 ? "READY" : progress >= 1 ? "DEMO COMPLETE" : `ILLUSTRATIVE STAGE · ${Math.round(progress * 100)}%`}</strong><span>VISUAL DEMONSTRATION · NOT NASA TIMING</span></div>
      <input aria-label="Scrub BASS-II illustrative timeline" type="range" min="0" max={DEMO_DURATION} step="0.05" value={elapsed} onChange={(event) => scrub(Number(event.target.value))} />
      <div className="bass-timeline-actions"><div><button type="button" className="bass-start" disabled={!active} onClick={() => { if (playing) setPlaying(false); else { if (progress >= 1) scrub(0); setPlaying(true); } }}>{playing ? <><Pause size={13} /> Pause</> : elapsed === 0 ? <><Play size={13} /> Start Experiment</> : <><Play size={13} /> Resume</>}</button><button type="button" onClick={reset}><RotateCcw size={12} /> Reset experiment</button></div><span>Drag to orbit · scroll or pinch to zoom</span></div>
    </div>
  </div>;
}
