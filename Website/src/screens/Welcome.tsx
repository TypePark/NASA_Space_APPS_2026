import { useEffect, useRef, useState } from "react";
import poster from "../assets/demo-poster.jpg";
import demo from "../assets/demo.mp4";
import Brand from "../components/Brand";
import Icon from "../components/Icon";
import { BASE_VARS, HOW_STEPS } from "../content";
import { SERIES } from "../data/series";
import { longestRecordYears } from "../model";

interface WelcomeProps {
  onTour: () => void;
}

// Everything on this page that names data is read from the data itself.
const YEARS = longestRecordYears();
const VARIABLES = BASE_VARS.filter((b) => SERIES.some((s) => s.variable === b.id));
const SOURCES = [...new Set(SERIES.map((s) => `NASA ${s.dataset_name}`))];
const listOf = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

export default function Welcome({ onTour }: WelcomeProps) {
  // The demo plays by itself, unless the visitor has asked their device for less motion.
  // Browsers only allow a video to start by itself without sound, so sound is one press away.
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    video.current?.play().catch(() => {});
  }, []);
  const togglePlay = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };
  const toggleSound = () => {
    const v = video.current;
    if (!v) return;
    v.muted = sound;
    setSound(!sound);
    if (v.paused) v.play().catch(() => {});
  };

  return (
    <section className="welcome">
      <header className="welcome-bar">
        <div className="brand">
          <Brand />
        </div>
        <nav aria-label="Main" className="topbar-nav">
          <a className="nav-link" href="#/explore">
            Explore
          </a>
          <a className="nav-link" href="#/map3d">
            3D Map
          </a>
          <a className="btn btn-outline btn-sm" href="#/method">
            Data &amp; Method
          </a>
        </nav>
      </header>

      <div className="welcome-main">
      <div className="welcome-hero">
        <span className="kicker">A data detective tool · NASA Space Apps 2026</span>
        <h1 className="display">Is Cyprus’s climate changing? Investigate it with NASA data.</h1>
        <p className="lead muted">
          Pick a question and a place. We show you up to {YEARS} years of NASA satellite and model data on{" "}
          {listOf(VARIABLES.map((v) => v.noun))}, how fast each is changing, and whether the change is real or still hidden in the noise.
        </p>
        <div className="row">
          <a className="btn btn-primary btn-lg" href="#/setup">
            Start an investigation
            <Icon name="arrowR" strokeWidth={2} />
          </a>
          <button type="button" className="btn btn-outline btn-lg" onClick={onTour}>
            <Icon name="play" />
            Take the guided tour
          </button>
        </div>
      </div>

        <div className="welcome-stage">
          <div className="mac">
            <div className="mac-bar" aria-hidden="true">
              <span className="mac-dot mac-red" />
              <span className="mac-dot mac-yellow" />
              <span className="mac-dot mac-green" />
              <span className="mac-title">AquaCosmos</span>
            </div>
            <div className="mac-screen">
              <video
                ref={video}
                src={demo}
                poster={poster}
                muted
                loop
                playsInline
                preload="metadata"
                aria-label="Demo of AquaCosmos: choosing a place and a question, reading the result, asking your own question, closing the case, the 3D map, and Data & Method."
                onClick={togglePlay}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
              />
              <div className="mac-controls">
                <button type="button" className="mac-btn" aria-label={playing ? "Pause the demo" : "Play the demo"} onClick={togglePlay}>
                  <Icon name={playing ? "pause" : "play"} size={18} strokeWidth={2} />
                </button>
                <button type="button" className="mac-btn mac-sound" aria-pressed={sound} onClick={toggleSound}>
                  <Icon name={sound ? "sound" : "mute"} size={18} strokeWidth={2} />
                  {sound ? "Sound on" : "Sound off"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="welcome-foot">
        <div className="how">
          {HOW_STEPS.map((s) => (
            <div key={s.title} className="how-step">
              <span className="round-icon">
                <Icon name={s.icon} size={22} />
              </span>
              <span className="stack-2">
                <span className="strong">{s.title}</span>
                <span className="small muted">{s.text}</span>
              </span>
            </div>
          ))}
        </div>

        <p className="tiny muted">Data: {listOf(SOURCES)}. Terrain on the 3D map: the NISAR elevation model.</p>
      </div>
    </section>
  );
}
