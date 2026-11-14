"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import {
  ArrowDownRight,
  ArrowUpRight,
  AudioLines,
  Check,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  Eye,
  Flame,
  Pause,
  Play,
  Radio,
  Sparkles,
  X,
} from "lucide-react";
import { experiments, type ExperimentId } from "@/lib/experiments";
import { flexTestRecordCount, recordsForExperiment } from "@/lib/research/corpus";
import { EvidenceCitation, ResearchWorkbench, initialResearchState } from "@/components/research-workbench";
import { FlexCombustionScene } from "@/components/flex-combustion-scene";
import { FlexDataLab } from "@/components/flex-data-lab";
import { FlexLearningMission, type MissionCheck, type MissionPrediction, type MissionStage } from "@/components/flex-learning-mission";
import { FlexSciencePanel } from "@/components/flex-science-panel";
import { evaluateFlex145Droplet } from "@/lib/physics/droplet-d2";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type Section = "explore" | "data" | "research" | "learn";
type Mode = "explore" | "research";
type LensTab = "overview" | "conditions" | "findings" | "limits" | "search" | "data";
type RenderQuality = "high" | "medium" | "low";
type FlexVisual = "model" | "archive";
type SourceLink = { label: string; href: string };

export function FlameExperience() {
  const [activeSection, setActiveSection] = useState<Section>("explore");
  const mode: Mode = activeSection === "research" ? "research" : "explore";
  const [experimentId, setExperimentId] = useState<ExperimentId>("flex");
  const [lensOpen, setLensOpen] = useState(false);
  const [lensTab, setLensTab] = useState<LensTab>("overview");
  const lensContentRef = useRef<HTMLDivElement>(null);
  const [researchState, setResearchState] = useState(initialResearchState);
  const [askOpen, setAskOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [flexVisual, setFlexVisual] = useState<FlexVisual>("model");
  const [missionStage, setMissionStage] = useState<MissionStage>("idle");
  const [missionPrediction, setMissionPrediction] = useState<MissionPrediction | null>(null);
  const [missionCheck, setMissionCheck] = useState<MissionCheck | null>(null);
  const [missionExplored, setMissionExplored] = useState(false);
  const [missionTime, setMissionTime] = useState(0);
  const [modelResetToken, setModelResetToken] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [answerSources, setAnswerSources] = useState<SourceLink[]>([]);
  const [askError, setAskError] = useState("");

  useEffect(() => {
    if (lensOpen && lensContentRef.current) lensContentRef.current.scrollTop = 0;
  }, [lensOpen, lensTab]);
  const [asking, setAsking] = useState(false);
  const [aiStatus, setAiStatus] = useState<"unknown" | "checking" | "available" | "unavailable" | "error">("unknown");
  const [renderQuality, setRenderQuality] = useState<RenderQuality>("medium");
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackPosition = useRef(0);
  const sceneRef = useRef<HTMLElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const introducedRef = useRef(false);
  const cameraTimeline = useRef<gsap.core.Timeline | null>(null);
  const askRequest = useRef<AbortController | null>(null);
  const experiment = experiments[experimentId];
  const records = recordsForExperiment(experimentId);
  const flexInitial = records.find((record) => record.id === "FLEX-145-INITIAL");
  const flexExtinction = records.find((record) => record.id === "FLEX-145-EXTINCTION");
  const flexRate = records.find((record) => record.id === "FLEX-145-RATE");
  const flexModeledDuration = evaluateFlex145Droplet(0).modeledDurationSeconds;
  const startMission = useCallback(() => {
    if (videoRef.current) {
      playbackPosition.current = videoRef.current.currentTime;
      videoRef.current.pause();
    }
    setPlaying(false);
    setActiveSection("learn");
    setMissionPrediction(null);
    setMissionCheck(null);
    setMissionExplored(false);
    setMissionTime(0);
    setModelResetToken((value) => value + 1);
    setMissionStage("predict");
  }, []);
  const handleModelActivity = useCallback((seconds: number) => {
    setMissionTime(seconds);
    if (seconds > 0.35) setMissionExplored(true);
  }, []);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const capabilities = navigator as Navigator & {
        deviceMemory?: number;
        connection?: { saveData?: boolean };
      };
      const memory = capabilities.deviceMemory;
      const cores = capabilities.hardwareConcurrency || 4;
      const saveData = capabilities.connection?.saveData === true;
      const tier: RenderQuality = saveData || cores <= 4 || (memory !== undefined && memory <= 4)
        ? "low"
        : memory !== undefined && memory >= 8 && cores >= 8
          ? "high"
          : "medium";
      setRenderQuality(tier);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (experimentId !== "flex" || !videoRef.current) {
      setPlaying(false);
      return;
    }
    videoRef.current.pause();
    videoRef.current.currentTime = playbackPosition.current;
    setPlaying(false);
  }, [experimentId]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const mobileSheet = window.innerWidth <= 700 && lensOpen;
    const target = { autoAlpha: 1, x: mobileSheet ? 0 : lensOpen ? -22 : 0, y: mobileSheet ? -9 : 0, scale: lensOpen ? .985 : 1 };
    gsap.killTweensOf(scene);
    if (reducedMotion) {
      introducedRef.current = true;
      gsap.set(scene, { autoAlpha: 1, x: target.x, y: target.y, scale: target.scale });
    } else if (!introducedRef.current) {
      introducedRef.current = true;
      gsap.fromTo(scene, { autoAlpha: 0, y: 12, scale: .993 }, { ...target, autoAlpha: 1, duration: .64, ease: "power3.out", overwrite: "auto" });
    } else {
      introducedRef.current = true;
      gsap.to(scene, { ...target, duration: .36, ease: "power3.inOut", overwrite: "auto" });
    }
    return () => gsap.killTweensOf(scene);
  }, [lensOpen, mode, reducedMotion]);

  useEffect(() => {
    const visual = visualRef.current;
    if (!visual) return;
    cameraTimeline.current?.kill();
    if (reducedMotion) {
      gsap.set(visual, { scale: 1 });
      return;
    }
    cameraTimeline.current = gsap.timeline({ defaults: { overwrite: "auto" } })
      .to(visual, { scale: 1.012, duration: .18, ease: "power2.out" })
      .to(visual, { scale: 1, duration: .32, ease: "power3.out" });
    return () => {
      cameraTimeline.current?.kill();
    };
  }, [experimentId, reducedMotion]);

  function changeExperiment(next: ExperimentId) {
    askRequest.current?.abort();
    setAsking(false);
    setAnswer("");
    setAnswerSources([]);
    setAskError("");
    if (videoRef.current) {
      playbackPosition.current = videoRef.current.currentTime;
      videoRef.current.pause();
    }
    setPlaying(false);
    setExperimentId(next);
    setFlexVisual("model");
    setMissionStage("idle");
    setMissionPrediction(null);
    setMissionCheck(null);
    setMissionExplored(false);
    setMissionTime(0);
  }

  async function togglePlayback() {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      try {
        if (!reducedMotion && visualRef.current) {
          gsap.to(visualRef.current, { scale: 1.025, duration: .48, ease: "power3.inOut", overwrite: "auto" });
        }
        await videoRef.current.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    } else {
      videoRef.current.pause();
      if (!reducedMotion && visualRef.current) {
        gsap.to(visualRef.current, { scale: 1, duration: .34, ease: "power3.out", overwrite: "auto" });
      }
      setPlaying(false);
    }
  }

  async function askFlame() {
    if (!question.trim() || asking || aiStatus !== "available") return;
    setAsking(true);
    setAnswer("");
    setAnswerSources([]);
    setAskError("");
    const controller = new AbortController();
    askRequest.current?.abort();
    askRequest.current = controller;
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experimentId, question }),
        signal: controller.signal,
      });
      const result = (await response.json()) as { answer?: string; sources?: SourceLink[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Could not generate an answer.");
      setAnswer(result.answer || "No answer was returned.");
      setAnswerSources(result.sources || []);
    } catch (error) {
      if (controller.signal.aborted) return;
      setAskError(error instanceof Error ? error.message : "Could not generate an answer.");
    } finally {
      if (!controller.signal.aborted) setAsking(false);
    }
  }

  async function openAsk() {
    setAskOpen(true);
    if (aiStatus !== "unknown" && aiStatus !== "error") return;
    setAiStatus("checking");
    setAskError("");
    try {
      const response = await fetch("/api/ask", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not check server configuration.");
      const result = (await response.json()) as { available?: boolean };
      setAiStatus(result.available ? "available" : "unavailable");
    } catch {
      setAiStatus("error");
      setAskError("Could not check whether AI is available. Close this dialog and try again.");
    }
  }

  function switchMode(next: Mode) {
    if (next === "research") pauseArchive();
    setActiveSection(next);
    setLensOpen(false);
  }

  function navigateSection(section: Section) {
    if (section === "learn") {
      if (experimentId !== "flex") changeExperiment("flex");
      if (missionStage === "idle") startMission();
      else setActiveSection("learn");
    } else {
      pauseArchive();
      setActiveSection(section);
      setLensOpen(false);
    }
  }

  function pauseArchive() {
    if (videoRef.current) {
      playbackPosition.current = videoRef.current.currentTime;
      videoRef.current.pause();
    }
    setPlaying(false);
  }

  return (
    <main className="flame-app" data-mode={mode} data-render-quality={renderQuality}>
      <a className="skip-link" href="#main">Skip to experiment</a>
      <header className="topbar">
        <a className="brand" href="#main" aria-label="FLAME home">
          <span className="brand-mark"><Flame size={17} strokeWidth={1.8} /></span>
          <span>FLAME</span>
          <span className="brand-divider" />
          <span className="brand-context">MICROGRAVITY COMBUSTION</span>
        </a>

        <nav className="mode-switch" aria-label="Primary sections" data-active={activeSection}>
          <span className="nav-indicator" aria-hidden="true" />
          {(["explore", "data", "research", "learn"] as const).map((section) => (
            <button
              key={section}
              className={activeSection === section ? "mode-button active" : "mode-button"}
              type="button"
              aria-current={activeSection === section ? "page" : undefined}
              aria-pressed={activeSection === section}
              onClick={() => section === "explore" || section === "research" ? switchMode(section) : navigateSection(section)}
            >
              {section === "data" ? "Data Lab" : section.charAt(0).toUpperCase() + section.slice(1)}
            </button>
          ))}
        </nav>

        <button
          type="button"
          className={lensOpen ? "lens-trigger active" : "lens-trigger"}
          aria-label={lensOpen ? "Close evidence lens" : "Open evidence lens"}
          aria-expanded={lensOpen}
          aria-controls="evidence-lens"
          onClick={() => setLensOpen((open) => !open)}
        >
          <Eye size={16} /> <span>Evidence lens</span>
          {lensOpen ? <X size={14} /> : <ArrowUpRight size={14} />}
        </button>
      </header>

      <div className="primary-content">
      <div className={`primary-view${activeSection === "explore" || activeSection === "learn" ? " is-active" : ""}`} aria-hidden={activeSection !== "explore" && activeSection !== "learn"}>
      <section className="scene" id="main" aria-labelledby="scene-title" ref={sceneRef}>
        <div className="scene-heading">
          <div className="eyebrow"><span className="live-dot" /> NASA EXPERIMENT ARCHIVE</div>
          <div className="heading-row">
            <div>
              <h1 id="scene-title" className={mode === "research" ? "research-hero" : undefined}>
                {activeSection === "research" ? <>DON&apos;T JUST ANSWER.<br className="research-break" /> SHOW THE EVIDENCE.</> : activeSection === "learn" ? <>HOW A DROPLET<br />CHANGES<span className="hero-period">.</span></> : <>FIRE WITHOUT<br />GRAVITY<span className="hero-period">.</span></>}
              </h1>
              <p className="scene-subtitle">{activeSection === "research" ? "Every answer begins with source-traceable NASA evidence." : activeSection === "learn" ? "PREDICT → EXPLORE → EXPLAIN → VERIFY" : "NASA measured it. FLAME makes it explorable."}</p>
            </div>
            <label className="experiment-select-wrap">
              <span className="select-label">SELECT EXPERIMENT</span>
              <span className="select-shell">
                <select
                  aria-label="Select experiment"
                  value={experimentId}
                  onChange={(event) => changeExperiment(event.target.value as ExperimentId)}
                >
                  <option value="flex">FLEX · Liquid droplets</option>
                  <option value="bass-ii">BASS-II · Solid fuels</option>
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </span>
            </label>
          </div>
        </div>

        <div className="scene-grid">
          <div className="visual-column">
            <div className={`experiment-visual ${experiment.media === "footage" ? "has-footage" : "is-illustration"}`}>
              <div className="visual-plane" ref={visualRef}>
              {experiment.media === "footage" ? (
                <>
                  <div className="visual-switch" role="group" aria-label="FLEX visual view">
                    <button type="button" className={flexVisual === "model" ? "active" : ""} aria-pressed={flexVisual === "model"} onClick={() => { videoRef.current?.pause(); setPlaying(false); setFlexVisual("model"); }}>3D reconstruction</button>
                    <button type="button" className={flexVisual === "archive" ? "active" : ""} aria-pressed={flexVisual === "archive"} onClick={() => setFlexVisual("archive")}>NASA footage</button>
                  </div>
                  <div className={flexVisual === "model" ? "flex-model-stage" : "flex-model-stage is-hidden"} aria-hidden={flexVisual !== "model"}>
                    <FlexCombustionScene active={(activeSection === "explore" || activeSection === "learn") && flexVisual === "model" && missionStage !== "explain" && missionStage !== "verify"} missionExploring={missionStage === "explore"} resetToken={modelResetToken} onModelActivity={handleModelActivity} />
                  </div>
                  {flexVisual === "archive" && <>
                  <Image className="visual-poster" src="/flex-still.jpg" alt="" fill sizes="(max-width: 700px) 100vw, 68vw" loading="eager" fetchPriority="high" />
                  <video
                    ref={videoRef}
                    className={playing ? "archival-video playing" : "archival-video"}
                    src="/flex-archival.mp4"
                    poster="/flex-still.jpg"
                    preload="none"
                    playsInline
                    muted
                    onTimeUpdate={(event) => { playbackPosition.current = event.currentTarget.currentTime; }}
                    onEnded={() => setPlaying(false)}
                    aria-label="NASA archival footage of a FLEX cool-flame test"
                  />
                  <div className="visual-vignette" />
                  <div className="media-badge"><span className="badge-dot" /> NASA ARCHIVAL FOOTAGE</div>
                  <button className="play-control" type="button" onClick={togglePlayback} aria-label={playing ? "Pause archival footage" : "Play archival footage"}>
                    {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
                  </button>
                  <div className="visual-caption">
                    <span>FLEX · COOL-FLAME SEQUENCE</span>
                    <span>NASA / GSFC</span>
                  </div>
                  </>}
                </>
              ) : (
                <div className="solid-schematic" aria-label="Illustrative diagram of flame spread over a solid fuel sample" role="img">
                  <div className="schematic-topline"><span>CONCEPTUAL DIAGRAM</span><span>NOT EXPERIMENTAL FOOTAGE</span></div>
                  <svg viewBox="0 0 720 420" aria-hidden="true" className="schematic-svg">
                    <defs>
                      <radialGradient id="glow"><stop stopColor="#ffb454" stopOpacity=".55"/><stop offset="1" stopColor="#ff6a32" stopOpacity="0"/></radialGradient>
                      <linearGradient id="flame"><stop stopColor="#ffd189"/><stop offset=".48" stopColor="#ff7a40"/><stop offset="1" stopColor="#f34831" stopOpacity=".08"/></linearGradient>
                    </defs>
                    <ellipse cx="366" cy="231" rx="194" ry="95" fill="url(#glow)" />
                    <path d="M226 271c18-45 24-88 58-123 21-22 31-49 37-84 40 34 46 72 36 103 29-29 42-57 48-90 47 47 58 91 40 129 28-13 47-36 58-69 22 34 26 77 7 115-30 57-101 65-154 65-54 0-106-12-130-46Z" fill="url(#flame)" opacity=".9" />
                    <path d="M151 291h418v37H151z" fill="#79736c"/><path d="M151 291h418" stroke="#f2bc78" strokeWidth="3"/>
                    <path d="M185 306h350" stroke="#3d3c39" strokeWidth="14" strokeDasharray="3 8"/>
                    <path d="M150 257h-55m55 0-12-8m12 8-12 8M570 257h55m-55 0 12-8m-12 8 12 8" fill="none" stroke="#d6d0c8" strokeOpacity=".58" strokeWidth="1.5"/>
                    <path d="M360 79v-31m0 31-6-9m6 9 6-9" fill="none" stroke="#b9b3aa" strokeOpacity=".7"/>
                  </svg>
                  <div className="schematic-annotation annotation-flow"><ArrowUpRight size={13}/> variable airflow</div>
                  <div className="schematic-annotation annotation-fuel"><ArrowDownRight size={13}/> solid fuel sample</div>
                  <div className="visual-caption"><span>BASS-II · SOLID-FUEL FLAME SPREAD</span><span>SCHEMATIC</span></div>
                </div>
              )}
              </div>
            </div>

            <div className="visual-meta">
              <div className="meta-title">
                <span className="meta-index">01</span>
                <div><strong>{experiment.shortName}</strong><span>{experiment.subtitle}</span></div>
              </div>
              <button className="text-action" type="button" onClick={() => { setLensOpen(true); setLensTab("overview"); }}>
                View source <ArrowUpRight size={14} />
              </button>
            </div>
          </div>

          <aside className="interpretation" aria-live="polite">
            {mode === "explore" && experimentId === "flex" && missionStage === "idle" && flexInitial && flexExtinction && flexRate ? (
              <FlexSciencePanel
                initial={flexInitial}
                extinction={flexExtinction}
                rate={flexRate}
                modeledDurationSeconds={flexModeledDuration}
                onBeginMission={startMission}
                onOpenDataLab={() => navigateSection("data")}
                onAsk={() => void openAsk()}
              />
            ) : <>
            <div className="interpretation-top">
              <span className="section-kicker">{mode === "explore" ? "THE PHENOMENON" : "EXPERIMENT BRIEF"}</span>
              {mode === "research" && <span className="verified-mark"><Check size={12} /> SOURCE TRACED</span>}
            </div>
            <h2>{mode === "explore" ? experimentId === "flex" ? "A flame without an up." : "Fire meets a different flow." : experiment.name}</h2>
            <p>{mode === "explore" ? experiment.explore : experiment.description}</p>
            {mode === "explore" ? (
              <div className="insight-note">
                <span className="note-symbol"><AudioLines size={15} /></span>
                <div><span className="note-label">LOOK CLOSER</span><p>{experiment.insight}</p></div>
              </div>
            ) : (
              <div className="condition-preview">
                {experiment.conditions.slice(0, 3).map((condition) => (
                  <div className="condition-row" key={condition.label}><span>{condition.label}</span><strong>{condition.value}</strong></div>
                ))}
                <button type="button" className="text-action conditions-link" onClick={() => { setLensOpen(true); setLensTab("conditions"); }}>All conditions <ArrowUpRight size={14} /></button>
              </div>
            )}
            {(activeSection === "explore" || activeSection === "learn") && experimentId === "flex" && missionStage !== "idle" && <FlexLearningMission
              stage={missionStage}
              prediction={missionPrediction}
              check={missionCheck}
              time={missionTime}
              explored={missionExplored}
              visualMode={flexVisual}
              onStart={startMission}
              onClose={() => { setMissionStage("idle"); setActiveSection("explore"); }}
              onPredict={setMissionPrediction}
              onLockPrediction={() => { setMissionExplored(false); setMissionTime(0); setModelResetToken((value) => value + 1); setMissionStage("explore"); }}
              onExplain={() => setMissionStage("explain")}
              onBeginVerify={() => { setMissionCheck(null); setMissionStage("verify"); }}
              onCheck={setMissionCheck}
              onRetryCheck={() => setMissionCheck(null)}
              onFinish={() => setMissionStage("complete")}
              onReplay={() => { setMissionPrediction(null); setMissionCheck(null); setMissionExplored(false); setMissionTime(0); setModelResetToken((value) => value + 1); setMissionStage("predict"); }}
              onReturnToModel={() => setFlexVisual("model")}
            />}
            <div className="interpretation-footer">
              <span className="source-count"><Radio size={13} /> {experiment.sources.length} PRIMARY SOURCE{experiment.sources.length > 1 ? "S" : ""}</span>
              <button className="ask-button" type="button" onClick={() => void openAsk()}><Sparkles size={14} /> Ask about this evidence</button>
            </div>
            </>}
          </aside>
        </div>

        <div className="bottom-rail">
          <span className="rail-prompt"><span className="rail-line" /> {mode === "explore" ? "A NASA SPACE STATION EXPERIMENT" : "SOURCE-TRACEABLE EXPERIMENT RECORD"}</span>
          <span className="rail-context">{experiment.shortName} <span>·</span> {experiment.media === "footage" ? "Recorded footage" : "Illustrative diagram"}</span>
        </div>
      </section>

      </div>
      <section className={`primary-view data-primary${activeSection === "data" ? " is-active" : ""}`} aria-hidden={activeSection !== "data"} aria-label="Data Lab">
        <FlexDataLab />
      </section>
      <section className={`primary-view research-primary${activeSection === "research" ? " is-active" : ""}`} aria-hidden={activeSection !== "research"} aria-label="Research">
        <header className="research-primary-head"><span className="section-kicker">FLAME / RESEARCH</span><div className="research-primary-title"><h1>DON&apos;T JUST ANSWER.<br />SHOW THE EVIDENCE.</h1><label className="experiment-select-wrap"><span className="select-label">RESEARCH SCOPE</span><span className="select-shell"><select aria-label="Research experiment" value={experimentId} onChange={(event) => changeExperiment(event.target.value as ExperimentId)}><option value="flex">FLEX · Liquid droplets</option><option value="bass-ii">BASS-II · Solid fuels</option></select><ChevronDown size={14} aria-hidden="true" /></span></label></div><p>Search NASA records, compare findings and inspect the limits behind every answer.</p></header>
        <div className="research-primary-tools">
          <div><ResearchWorkbench experimentId={experimentId} detailed state={researchState} onChange={setResearchState} /></div>
          <aside className="research-context"><span className="section-kicker">SOURCE LENS</span><h2>Trace each result.</h2><p>Open Evidence Lens for study conditions, findings, limitations and original NASA sources.</p><button type="button" className="text-action" onClick={() => { setLensTab("overview"); setLensOpen(true); }}>Open Evidence Lens <ArrowUpRight size={14} /></button><button type="button" className="text-action" onClick={() => void openAsk()}><Sparkles size={14} /> Ask FLAME</button></aside>
        </div>
      </section>
      </div>

      {lensOpen && (
        <>
          <button className="panel-scrim" type="button" aria-label="Close evidence lens" onClick={() => setLensOpen(false)} />
          <aside className={`evidence-panel${lensTab === "data" ? " data-lab-panel" : ""}`} id="evidence-lens" aria-label="Evidence lens">
            <div className="panel-head">
              <div><span className="section-kicker">FLAME / EVIDENCE LENS</span><h2>Trace the source.</h2></div>
              <button className="icon-button" type="button" onClick={() => setLensOpen(false)} aria-label="Close evidence lens"><X size={17} /></button>
            </div>
            <div className="panel-experiment"><span className="panel-exp-icon"><Flame size={15} /></span><div><strong>{experiment.shortName}</strong><span>{experiment.name}</span></div><span className="verified-mark"><Check size={12} /> VERIFIED</span></div>
            <Tabs value={lensTab} onValueChange={(value) => setLensTab(value as LensTab)} className="lens-tabs-root">
            <TabsList className="lens-tabs" aria-label="Evidence sections">
              {(experimentId === "flex" ? ["overview", "conditions", "findings", "limits", "search", "data"] : ["overview", "conditions", "findings", "limits", "search"] as LensTab[]).map((tab) => (
                <TabsTrigger key={tab} className={lensTab === tab ? "lens-tab selected" : "lens-tab"} value={tab}>{tab === "limits" ? "Limits" : tab === "data" ? "Data Lab" : tab.charAt(0).toUpperCase() + tab.slice(1)}</TabsTrigger>
              ))}
            </TabsList>
            <TabsContent ref={lensContentRef} className="lens-content" value={lensTab}>
              {lensTab === "search" && <div className="section-bridge"><p>Search, rank and compare evidence in the full Research workspace.</p><button type="button" className="text-action" onClick={() => navigateSection("research")}>Open Research <ArrowUpRight size={14} /></button></div>}
              {lensTab === "data" && (experimentId === "flex" ? <div className="section-bridge"><p>{flexTestRecordCount} individual FLEX test records · one NASA report.</p><button type="button" className="text-action" onClick={() => navigateSection("data")}>Open NASA Data Lab <ArrowUpRight size={14} /></button></div> : <p className="research-caption">The imported Data Lab records are for FLEX. Select the FLEX experiment to view them.</p>)}
              {lensTab === "overview" && <>
                <span className="section-kicker">RESEARCH OBJECTIVE</span>
                <p className="lens-description">{mode === "research" ? experiment.description : records.find((record) => record.evidenceType === "experiment-description")?.summary}</p>
                <button className="text-action research-entry" type="button" onClick={() => setLensTab("search")}>Search & compare evidence <ArrowUpRight size={14} /></button>
                <span className="section-kicker source-heading">ORIGINAL SOURCES</span>
                <div className="source-list">{experiment.sources.map((source) => <a className="source-item" href={source.href} target="_blank" rel="noreferrer" key={source.href}><span className="source-copy"><strong>{source.label}</strong><span>{source.detail}</span></span><ExternalLink size={14} /></a>)}</div>
                <div className="media-integrity"><span className="badge-dot" /><div><strong>{experiment.media === "footage" ? "Archival footage" : "Illustrative diagram"}</strong><span>{experiment.media === "footage" ? "NASA / Goddard Space Flight Center · original video" : "FLAME concept drawing · not a NASA image or measurement"}</span></div></div>
              </>}
              {lensTab === "conditions" && <>
                <span className="section-kicker">AVAILABLE EXPERIMENTAL CONDITIONS</span>
                <div className="lens-conditions">{experiment.conditions.map((condition) => <div className="lens-condition" key={condition.label}><span>{condition.label}</span><strong>{condition.value}</strong>{condition.note && <small>{condition.note}</small>}</div>)}</div>
                <EvidenceCitation record={records.find((record) => record.id === "FLEX-145-INITIAL") ?? records[0]} />
                <p className="research-caption">Conditions belong to the cited record. They are not assigned to the archival video.</p>
                {experimentId === "flex" && <button type="button" className="data-lab-entry" onClick={() => navigateSection("data")}><span><strong>Open NASA Data Lab</strong><small>{flexTestRecordCount} individual FLEX tests · one report</small></span><ArrowUpRight size={15} /></button>}
              </>}
              {lensTab === "findings" && <>
                <span className="section-kicker">REPORTED FINDINGS</span>
                <div className="finding-list">{records.filter((record) => record.evidenceType !== "experiment-description").map((record, index) => <div className="finding" key={record.id}><span className="finding-index">0{index + 1}</span><div><p>{mode === "research" ? record.finding : record.summary}</p><EvidenceCitation record={record} />{mode === "research" && <p className="record-kind">{record.evidenceType} · {record.measurement?.uncertaintyNote ?? record.availability}</p>}</div></div>)}</div>
              </>}
              {lensTab === "limits" && <>
                <span className="section-kicker">READ WITH CARE</span>
                <div className="limitation-list">{experiment.limitations.map((limitation) => <p key={limitation}><CircleHelp size={15} />{limitation}</p>)}</div>
              </>}
            </TabsContent>
            </Tabs>
            <div className="panel-footer"><span><Check size={13} /> {experiment.sources.length} source{experiment.sources.length > 1 ? "s" : ""} linked to this record</span><span>FLAME / 01</span></div>
          </aside>
        </>
      )}

      <Dialog open={askOpen} onOpenChange={(open) => {
        setAskOpen(open);
        if (!open) {
          askRequest.current?.abort();
          askRequest.current = null;
          setAsking(false);
        }
      }}>
          <DialogContent className="ask-dialog" showCloseButton={false} aria-describedby="ask-description">
            <DialogClose asChild><button type="button" className="icon-button dialog-close" aria-label="Close"><X size={17} /></button></DialogClose>
            <span className="dialog-icon"><Sparkles size={18} /></span>
            <span className="section-kicker">SOURCE-GROUNDED ASSISTANT</span>
            <DialogTitle className="ask-title">Ask about {experiment.shortName}.</DialogTitle>
            {aiStatus === "available" ? <DialogDescription id="ask-description" className="ask-description">Questions are answered against the selected experiment’s cited record.</DialogDescription> : aiStatus === "checking" || aiStatus === "unknown" ? <DialogDescription id="ask-description" className="ask-description">Checking server configuration…</DialogDescription> : aiStatus === "error" ? <DialogDescription id="ask-description" className="ask-description">{askError}</DialogDescription> : <DialogDescription id="ask-description" className="ask-description missing-key">AI is not configured for this deployment. Set <code>GOOGLE_GENERATIVE_AI_API_KEY</code> on the server to enable source-grounded answers. No answer is being generated.</DialogDescription>}
            <label className="question-field"><span>Your question</span><input type="text" name="question" autoComplete="off" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void askFlame(); }} placeholder="e.g. What does extinction diameter mean…" disabled={aiStatus !== "available" || asking} maxLength={600} /></label>
            <button className="submit-question" type="button" disabled={aiStatus !== "available" || asking || question.trim().length < 3} onClick={() => void askFlame()}><Sparkles size={14} /> {asking ? "Checking sources…" : aiStatus === "available" ? "Ask FLAME" : aiStatus === "checking" || aiStatus === "unknown" ? "Checking…" : "AI unavailable"}</button>
            {(answer || askError) && <div className={askError ? "ai-result error" : "ai-result"} role="status">{answer ? <><span>{answer}</span>{answerSources.length > 0 && <span className="ai-source-links">Validated citation links: {answerSources.map((source, index) => <span key={source.label}>{index > 0 ? ", " : ""}<a href={source.href} target="_blank" rel="noreferrer">{source.label}</a></span>)}</span>}</> : askError}</div>}
            <span className="answer-footnote">Answers cite only the selected experiment sources. Review limitations before applying findings.</span>
          </DialogContent>
      </Dialog>

      <footer className="app-footer"><span>FLAME <span className="footer-separator">/</span> FLAME IN FREEFALL</span><span>AN EVIDENCE-LED EXPLORATION</span><a href="https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/" target="_blank" rel="noreferrer">NASA SPACE APPS 2026 <ExternalLink size={11} /></a></footer>
    </main>
  );
}
