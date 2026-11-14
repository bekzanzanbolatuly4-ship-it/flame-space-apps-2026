"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Pause, Play, RotateCcw } from "lucide-react";
import * as THREE from "three";
import { evaluateFlex145Droplet, FLEX_145_D2_PARAMETERS, type DropletD2Result } from "@/lib/physics/droplet-d2";

type Quality = "high" | "balanced" | "conservative";

// Illustrative display mapping only: 140 render units per metre; it does not set flame size.
const DROPLET_RENDER_UNITS_PER_METER = 140;
const MODEL_DURATION = evaluateFlex145Droplet(0).modeledDurationSeconds;
const INITIAL_DIAMETER_MM = FLEX_145_D2_PARAMETERS.initialDiameterM * 1000;
const EXTINCTION_DIAMETER_MM = FLEX_145_D2_PARAMETERS.extinctionDiameterM * 1000;
const EFFECTIVE_RATE_MM2_S = FLEX_145_D2_PARAMETERS.effectiveRateM2PerS * 1e6;

function displayRadius(diameterM: number) {
  return diameterM * DROPLET_RENDER_UNITS_PER_METER / 2;
}

const flameVertex = /* glsl */ `
  uniform float uTime;
  uniform float uLayer;
  varying vec3 vLocal;
  varying vec3 vWorld;
  varying vec3 vNormalWorld;
  void main() {
    vec3 direction = normalize(position);
    float broadSwell = sin(dot(direction, vec3(2.1, 2.7, 1.8)) + uTime * 0.15)
      * cos(dot(direction, vec3(-1.4, 2.3, -2.1)) - uTime * 0.11);
    float softFold = sin(dot(direction, vec3(4.1, 2.8, 1.6)) + uTime * 0.21 + uLayer * 1.3);
    vec3 displaced = position * (1.0 + broadSwell * 0.09 + softFold * 0.02);
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
    float t = uTime * 0.075;
    float broad = noise(p * 1.65 + vec3(t * 0.42, -t * 0.28, t * 0.31));
    float billow = uQuality > 0.5 ? noise(p * 2.8 + vec3(-t * 0.24, t * 0.36, -t * 0.3)) : broad;
    float flow = mix(broad, billow, 0.24);
    float latitude = 0.74 + 0.26 * sin(p.y * 3.2 + broad * 2.1 + t * 0.55);
    float density = 0.06 + 0.94 * smoothstep(0.38, 0.68, flow);
    float facing = abs(dot(normalize(vNormalWorld), normalize(cameraPosition - vWorld)));
    float bandCenter = uLayer < 0.5 ? 0.25 : uLayer < 1.5 ? 0.3 : 0.27;
    float bandWidth = 0.14;
    float turbulence = (broad - 0.5) * 0.4 + (billow - 0.5) * 0.2 + sin(p.y * 3.1 + p.x * 1.5 + broad * 3.0 + t * 0.4) * 0.04;
    float warpedCenter = clamp(bandCenter + turbulence, 0.04, 0.7);
    float bandDistance = (facing - warpedCenter) / bandWidth;
    float reactionBand = exp(-bandDistance * bandDistance) * smoothstep(0.0, 0.08, facing);
    float nearDroplet = pow(facing, 10.0) * 0.035;
    float layerStrength = uLayer < 0.5 ? 0.16 : uLayer < 1.5 ? 0.13 : 0.14;
    float alpha = layerStrength * density * latitude * (reactionBand + nearDroplet);
    float violet = smoothstep(0.56, 0.82, broad) * (uLayer > 1.5 ? 0.2 : 0.07);
    float emission = 0.42 + 0.58 * smoothstep(0.25, 0.78, flow);
    vec3 blue = mix(vec3(0.006, 0.04, 0.09), vec3(0.09, 0.48, 0.68), emission);
    vec3 color = mix(blue, vec3(0.17, 0.13, 0.3), violet);
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
  varying vec3 vWorld;
  varying vec3 vNormalWorld;
  void main() {
    vec3 n = normalize(vNormalWorld);
    vec3 v = normalize(cameraPosition - vWorld);
    vec3 l = normalize(vec3(0.35, 0.55, 3.2) - vWorld);
    float diffuse = max(dot(n, l), 0.0);
    float specular = pow(max(dot(reflect(-l, n), v), 0.0), 30.0);
    float fresnel = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    vec3 body = mix(vec3(0.015, 0.044, 0.055), vec3(0.075, 0.22, 0.25), clamp(diffuse * 0.66 + n.y * 0.14, 0.0, 0.78));
    vec3 color = body + vec3(0.47, 0.84, 0.94) * specular * 0.88 + vec3(0.06, 0.44, 0.59) * fresnel * 0.5;
    gl_FragColor = vec4(color, 1.0);
  }
`;

function FlameShell({ radius, layer, time, quality }: { radius: number; layer: number; time: RefObject<number>; quality: Quality }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  useFrame(() => {
    if (material.current) material.current.uniforms.uTime.value = time.current;
  });
  const segments = quality === "high" ? 72 : quality === "balanced" ? 48 : 28;
  return <mesh scale={[1, 1.015 + layer * 0.012, 0.985 - layer * 0.008]}>
    <sphereGeometry args={[radius, segments, Math.floor(segments * 0.72)]} />
    <shaderMaterial ref={material} vertexShader={flameVertex} fragmentShader={flameFragment} uniforms={{ uTime: { value: time }, uLayer: { value: layer }, uQuality: { value: quality === "high" ? 1 : 0 } }} transparent depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
  </mesh>;
}

function FlameObject({ quality, reducedMotion, modelDiameterM }: { quality: Quality; reducedMotion: boolean; modelDiameterM: RefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const droplet = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    if (!reducedMotion) elapsed.current += Math.min(delta, 0.05);
    if (droplet.current) droplet.current.scale.setScalar(displayRadius(modelDiameterM.current));
    if (group.current && !reducedMotion) {
      group.current.rotation.y = Math.sin(elapsed.current * 0.19) * 0.045;
      group.current.rotation.x = Math.sin(elapsed.current * 0.13) * 0.025;
    }
  });
  return <group ref={group}>
    <FlameShell radius={1.12} layer={0} time={elapsed} quality={quality} />
    <FlameShell radius={1.105} layer={2} time={elapsed} quality={quality} />
    <FlameShell radius={1.09} layer={1} time={elapsed} quality={quality} />
    <group ref={droplet}>
      <mesh>
        <sphereGeometry args={[1, quality === "high" ? 48 : 28, quality === "high" ? 36 : 20]} />
        <shaderMaterial vertexShader={dropletVertex} fragmentShader={dropletFragment} />
      </mesh>
      <mesh scale={1.035}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshBasicMaterial color="#70e3ff" transparent opacity={0.06} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
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

export function FlexCombustionScene({ active = true, missionExploring = false, resetToken = 0, onModelActivity }: { active?: boolean; missionExploring?: boolean; resetToken?: number; onModelActivity?: (seconds: number) => void }) {
  const [quality, setQuality] = useState<Quality>("high");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const elapsedRef = useRef(0);
  const diameterRef = useRef(evaluateFlex145Droplet(0).diameterM);
  const activeRef = useRef(active);
  const resetRef = useRef(resetToken);

  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    if (resetRef.current === resetToken) return;
    resetRef.current = resetToken;
    const frame = window.requestAnimationFrame(() => {
      setPlaying(false);
      elapsedRef.current = 0;
      diameterRef.current = evaluateFlex145Droplet(0).diameterM;
      setElapsed(0);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [resetToken]);

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
        const next = Math.min(MODEL_DURATION, elapsedRef.current + (now - previous) / 1000);
        elapsedRef.current = next;
        diameterRef.current = evaluateFlex145Droplet(next).diameterM;
        if (now - lastPublished >= 60 || next >= MODEL_DURATION) {
          setElapsed(next);
          if (missionExploring) onModelActivity?.(next);
          lastPublished = now;
        }
        if (next >= MODEL_DURATION) {
          setPlaying(false);
          return;
        }
      }
      previous = now;
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [playing, missionExploring, onModelActivity]);

  useEffect(() => {
    const qualityFrame = window.requestAnimationFrame(() => setQuality(getInitialQuality()));
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(motion.matches);
    const updateVisibility = () => {
      const nextVisible = !document.hidden;
      setVisible(nextVisible);
      if (!nextVisible) {
        setElapsed(elapsedRef.current);
        setPlaying(false);
      }
    };
    updateMotion();
    updateVisibility();
    motion.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      window.cancelAnimationFrame(qualityFrame);
      motion.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  const dpr: [number, number] = quality === "high" ? [1, 1.65] : quality === "balanced" ? [1, 1.2] : [0.8, 1];
  const modelState: DropletD2Result = evaluateFlex145Droplet(elapsed);
  const setModelTime = (seconds: number) => {
    const bounded = Math.max(0, Math.min(MODEL_DURATION, seconds));
    const endpointTolerance = Number.EPSILON * Math.max(1, MODEL_DURATION) * 8;
    const next = MODEL_DURATION - bounded <= endpointTolerance ? MODEL_DURATION : bounded;
    elapsedRef.current = next;
    diameterRef.current = evaluateFlex145Droplet(next).diameterM;
    setElapsed(next);
    if (missionExploring) onModelActivity?.(next);
    if (next >= MODEL_DURATION) setPlaying(false);
  };
  const diameterStatus = elapsed === 0 || modelState.status === "terminated"
    ? "SLIDE 10 SOURCE VALUE · CONFLICT UNRESOLVED"
    : "COMPUTED FROM DISPUTED SLIDE 10 INPUTS";

  return <div className="flex-model-canvas" aria-label="Three-dimensional model reconstruction of a suspended FLEX fuel droplet" data-model-diameter-m={modelState.diameterM} data-droplet-render-radius={displayRadius(modelState.diameterM)} data-model-status={modelState.status}>
    <div className="flex-render-surface"><Canvas camera={{ position: [0.18, 0.12, 4.4], fov: 34 }} dpr={dpr} frameloop={active && visible ? "always" : "demand"} gl={{ alpha: true, antialias: quality !== "conservative", powerPreference: "high-performance", depth: true, stencil: false }} fallback={<div className="webgl-unavailable">WebGL is unavailable on this device. The NASA archival FLEX footage remains available in the adjacent view.</div>} onCreated={({ gl }) => { gl.setClearColor("#05080d", 0); }}>
      <ambientLight intensity={0.34} />
      <pointLight position={[2.6, 1.8, 2.5]} color="#91dfff" intensity={4.2} distance={6} />
      <pointLight position={[-2.4, -0.7, -1.4]} color="#7258c5" intensity={2.2} distance={5} />
      <FlameObject quality={quality} reducedMotion={reducedMotion} modelDiameterM={diameterRef} />
      <PerformanceProbe quality={quality} onQuality={setQuality} />
      <OrbitControls makeDefault enablePan={false} enableZoom={false} enableDamping dampingFactor={0.08} autoRotate={!reducedMotion} autoRotateSpeed={0.16} minPolarAngle={Math.PI * 0.32} maxPolarAngle={Math.PI * 0.68} />
    </Canvas></div>
    <div className="model-reconstruction-badge">MODEL RECONSTRUCTION</div>
    <div className="model-envelope-label">ILLUSTRATIVE COMBUSTION ENVELOPE · NOT PREDICTED BY THE d² MODEL</div>
    <section className="d2-instrument" aria-label="Conditional FLEX-145 slide 10 scenario timeline">
      <div className="d2-reading"><div><span className="d2-kicker">CURRENT DROPLET DIAMETER</span><strong aria-live="off">{(modelState.diameterM * 1000).toFixed(3)} <small>mm</small></strong><span className="d2-value-status">{diameterStatus}</span></div>
        <div className="d2-model-time"><span className="d2-kicker">CONDITIONAL SCENARIO TIME</span><strong>{elapsed.toFixed(2)} <small>/ {MODEL_DURATION.toFixed(2)} s</small></strong><span className="d2-value-status">{modelState.status === "terminated" ? "MODEL TERMINATED AT SLIDE 10 ENDPOINT" : "CONDITIONAL · d² LAW · SOURCE CONFLICT"}</span></div>
      </div>
      <label className="d2-scrubber"><span className="sr-only">Scrub FLEX-145 model time</span><input aria-label="Scrub FLEX-145 model time" type="range" min="0" max={MODEL_DURATION} step="any" value={elapsed} onChange={(event) => setModelTime(Number(event.target.value))} style={{ "--d2-progress": `${modelState.normalizedProgress * 100}%`, caretColor: "transparent" } as CSSProperties} /></label>
      <div className="d2-controls"><div className="d2-buttons"><button type="button" aria-label={playing ? "Pause d squared model" : "Play d squared model"} disabled={!active || modelState.status === "terminated"} onClick={() => { if (playing) { setPlaying(false); setModelTime(elapsedRef.current); } else setPlaying(true); }}>{playing ? <Pause size={13} /> : <Play size={13} />}<span>{playing ? "Pause" : "Play"}</span></button><button type="button" aria-label="Restart d squared model" onClick={() => { setPlaying(false); setModelTime(0); }}><RotateCcw size={12} /><span>Restart</span></button></div>
        <span className="d2-rate">K <strong>{EFFECTIVE_RATE_MM2_S.toFixed(3)} mm²/s</strong> · SLIDE 10 INPUT · CONFLICTED</span>
      </div>
      <details className="d2-provenance" id="physics-limitations"><summary>Conditional model, source conflict & limits</summary><p>This scenario uses only slide 10’s FLEX-145 / C01M201 annotations: D₀ {INITIAL_DIAMETER_MM.toFixed(3)} mm, Dext {EXTINCTION_DIAMETER_MM.toFixed(3)} mm, and Kavg {EFFECTIVE_RATE_MM2_S.toFixed(3)} mm²/s. Slide 9 gives conflicting values and a different K unit; the source does not identify a correction. Intermediate diameters and interval are conditional calculations, not resolved NASA measurements or a measured time series. The finite endpoint is slide 10’s labeled visible-flame extinction value; the flame envelope remains illustrative.</p><div>{modelState.provenance.map((source) => <a key={source.recordId} href={source.sourceUrl} target="_blank" rel="noreferrer">SLIDE 10 {source.category.toUpperCase()} · {source.recordId} ↗</a>)}</div></details>
    </section>
  </div>;
}
