import { useState, useEffect, useRef } from "react";

/* ─── Inline styles ─────────────────────────────────────────────────── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --ink:    #0a0a0f;
    --paper:  #f5f2ec;
    --cream:  #ede9e0;
    --accent:rgb(155, 42, 200);
    --gold:   #d4a84b;
    --muted:  #8a8680;
    --border: rgba(10,10,15,.12);
    --serif:  'DM Serif Display', Georgia, serif;
    --sans:   'Outfit', sans-serif;
    --mono:   'DM Mono', monospace;
    --ease:   cubic-bezier(.22,.68,0,1.2);
  }

  html { scroll-behavior: smooth; }

  body {
    background: var(--ink);
    color: var(--paper);
    font-family: var(--sans);
    font-weight: 400;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Layout ── */
  .lp { overflow-x: hidden; }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 0 2rem; }

  /* ── Nav ── */
  .nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    border-bottom: 1px solid rgba(245,242,236,.08);
    backdrop-filter: blur(18px) saturate(1.4);
    background: rgba(10,10,15,.7);
  }
  .nav-inner {
    display: flex; align-items: center; gap: 2rem;
    height: 64px; justify-content: space-between;
  }
  .nav-logo {
    display: flex; align-items: center; gap: .6rem;
    font-family: var(--mono); font-size: .9rem; letter-spacing: .04em;
    color: var(--paper); text-decoration: none;
  }
  .nav-logo-mark {
    width: 28px; height: 28px; border: 1.5px solid var(--accent);
    display: grid; place-items: center; font-size: .65rem;
    font-family: var(--mono); color: var(--accent);
  }
  .nav-links {
    display: flex; gap: 2rem; list-style: none;
  }
  .nav-links a {
    font-size: .82rem; letter-spacing: .06em; text-transform: uppercase;
    color: var(--muted); text-decoration: none; transition: color .2s;
  }
  .nav-links a:hover { color: var(--paper); }
  .nav-cta {
    display: flex; gap: .75rem;
  }
  .btn {
    font-family: var(--mono); font-size: .78rem; letter-spacing: .06em;
    text-transform: uppercase; text-decoration: none; cursor: pointer;
    border: none; transition: all .2s var(--ease);
    display: inline-flex; align-items: center; gap: .45rem;
    padding: .6rem 1.25rem;
  }
  .btn-ghost {
    background: transparent; color: var(--muted);
    border: 1px solid rgba(245,242,236,.15);
  }
  .btn-ghost:hover { color: var(--paper); border-color: rgba(245,242,236,.4); }
  .btn-solid {
    background: var(--accent); color: var(--paper);
  }
  .btn-solid:hover { background:rgb(52, 63, 217); transform: translateY(-1px); }
  .btn-lg { padding: .85rem 2rem; font-size: .85rem; }

  /* ── Hero ── */
  .hero {
    min-height: 100vh;
    display: flex; flex-direction: column; justify-content: center;
    padding: 120px 0 80px;
    position: relative; overflow: hidden;
  }
  .hero-grid {
    position: absolute; inset: 0; pointer-events: none;
    background-image:
      linear-gradient(rgba(245,242,236,.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(245,242,236,.04) 1px, transparent 1px);
    background-size: 80px 80px;
    mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, black, transparent);
  }
  .hero-accent-bar {
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent, var(--accent) 40%, var(--gold) 60%, transparent);
  }
  .hero-inner {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 5rem; align-items: center;
  }
  .hero-eyebrow {
    display: inline-flex; align-items: center; gap: .6rem;
    font-family: var(--mono); font-size: .72rem; letter-spacing: .12em;
    text-transform: uppercase; color: var(--accent);
    margin-bottom: 1.75rem;
  }
  .hero-eyebrow-line {
    width: 32px; height: 1px; background: var(--accent);
  }
  .hero-h1 {
    font-family: var(--serif); font-size: clamp(2.6rem, 4vw, 4rem);
    line-height: 1.1; font-weight: 400; color: var(--paper);
    margin-bottom: 1.5rem;
  }
  .hero-h1 em { color: var(--accent); font-style: italic; }
  .hero-sub {
    font-size: 1.05rem; line-height: 1.75; color: var(--muted);
    max-width: 480px; margin-bottom: 2.5rem;
  }
  .hero-actions { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 3.5rem; }
  .hero-metrics {
    display: flex; gap: 2.5rem; padding-top: 2rem;
    border-top: 1px solid var(--border);
  }
  .metric-val {
    font-family: var(--serif); font-size: 2rem; color: var(--paper);
    line-height: 1;
  }
  .metric-label {
    font-size: .75rem; color: var(--muted); margin-top: .3rem;
    letter-spacing: .03em; line-height: 1.4;
  }

  /* ── Hero Frame ── */
  .hero-visual { position: relative; }
  .frame {
    background: rgba(245,242,236,.04);
    border: 1px solid rgba(245,242,236,.1);
    border-radius: 2px;
    overflow: hidden;
    backdrop-filter: blur(4px);
  }
  .frame-chrome {
    display: flex; align-items: center; gap: .75rem;
    padding: .75rem 1rem;
    border-bottom: 1px solid rgba(245,242,236,.08);
    background: rgba(245,242,236,.03);
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .dot-r { background: #ff5f57; }
  .dot-y { background: #febc2e; }
  .dot-g { background: #28c840; }
  .frame-title {
    flex: 1; text-align: center;
    font-family: var(--mono); font-size: .72rem;
    color: var(--muted); letter-spacing: .06em;
  }
  .live-chip {
    font-family: var(--mono); font-size: .65rem;
    color: #28c840; letter-spacing: .08em;
    display: flex; align-items: center; gap: .3rem;
  }
  .live-dot { width: 5px; height: 5px; border-radius: 50%; background: #28c840; animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }

  .frame-body { padding: 1.25rem; }
  .stage-row {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: .75rem;
    margin-bottom: .75rem;
  }
  .stage-col { display: flex; flex-direction: column; gap: .5rem; }
  .stage-head {
    font-family: var(--mono); font-size: .65rem;
    letter-spacing: .08em; text-transform: uppercase;
    color: var(--muted); padding-bottom: .4rem;
    border-bottom: 1px solid rgba(245,242,236,.08);
  }
  .card {
    background: rgba(245,242,236,.05);
    border: 1px solid rgba(245,242,236,.1);
    padding: .75rem; border-radius: 1px;
    transition: border-color .2s;
  }
  .card:hover { border-color: rgba(200,82,42,.5); }
  .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: .4rem; }
  .client { font-family: var(--mono); font-size: .7rem; color: var(--paper); letter-spacing: .04em; }
  .tag {
    font-size: .6rem; font-family: var(--mono); letter-spacing: .06em;
    padding: .15rem .4rem; border-radius: 1px;
  }
  .tag-high { background: rgba(200,82,42,.2); color: #e07a5f; }
  .tag-med  { background: rgba(212,168,75,.2); color: var(--gold); }
  .card-days { font-size: .68rem; color: var(--muted); margin-bottom: .35rem; }
  .card-email { font-size: .63rem; font-family: var(--mono); color: var(--muted); }
  .card-email.hot { color: #28c840; }
  .empty-col {
    display: flex; align-items: center; justify-content: center;
    height: 70px;
    border: 1px dashed rgba(245,242,236,.08);
    font-family: var(--mono); font-size: .65rem; color: rgba(245,242,236,.15);
  }

  /* ── Section base ── */
  .section { padding: 100px 0; }
  .section-alt { background: rgba(245,242,236,.025); }
  .section-head { text-align: center; margin-bottom: 4.5rem; }
  .section-eyebrow {
    display: inline-block; font-family: var(--mono); font-size: .7rem;
    letter-spacing: .14em; text-transform: uppercase;
    color: var(--accent); margin-bottom: 1rem;
  }
  .h2 {
    font-family: var(--serif); font-size: clamp(2rem,3vw,2.8rem);
    font-weight: 400; line-height: 1.15; color: var(--paper);
    margin-bottom: 1rem;
  }
  .h2 em { color: var(--accent); font-style: italic; }
  .sub { font-size: 1rem; color: var(--muted); max-width: 520px; margin: 0 auto; line-height: 1.7; }

  /* ── Features ── */
  .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5px; background: var(--border); }
  .feat {
    background: var(--ink); padding: 2.5rem;
    transition: background .25s;
  }
  .feat:hover { background: rgba(245,242,236,.035); }
  .feat-num {
    font-family: var(--mono); font-size: .68rem; letter-spacing: .1em;
    color: var(--accent); margin-bottom: 1.5rem;
    display: flex; align-items: center; gap: .6rem;
  }
  .feat-num::after { content: ''; flex: 1; height: 1px; background: rgba(200,82,42,.25); }
  .feat h3 {
    font-family: var(--serif); font-size: 1.35rem; font-weight: 400;
    color: var(--paper); margin-bottom: .5rem;
  }
  .feat-kicker { font-family: var(--mono); font-size: .7rem; color: var(--gold); letter-spacing: .06em; margin-bottom: .9rem; }
  .feat p { font-size: .9rem; color: var(--muted); line-height: 1.7; }

  /* ── Views split ── */
  .views-split { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; background: var(--border); }
  .panel { background: var(--ink); padding: 2.5rem; }
  .panel-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 1.75rem; }
  .panel h3 { font-family: var(--serif); font-size: 1.6rem; font-weight: 400; color: var(--paper); }
  .chip {
    font-family: var(--mono); font-size: .65rem; letter-spacing: .08em;
    text-transform: uppercase; color: var(--accent);
    border: 1px solid rgba(200,82,42,.35); padding: .2rem .55rem;
  }
  .check-list { list-style: none; display: flex; flex-direction: column; gap: .6rem; margin-bottom: 2rem; }
  .check-list li { display: flex; align-items: center; gap: .65rem; font-size: .88rem; color: var(--muted); }
  .check-icon { color: var(--accent); flex-shrink: 0; font-size: .8rem; }
  .mini-board { display: flex; gap: .5rem; }
  .mini-pill {
    font-family: var(--mono); font-size: .68rem; letter-spacing: .04em;
    padding: .3rem .7rem; border: 1px solid rgba(245,242,236,.12); color: var(--muted);
  }
  .mini-table { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 1px; background: var(--border); }
  .mini-th { font-family: var(--mono); font-size: .65rem; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); padding: .4rem .6rem; background: var(--ink); }
  .mini-td { font-size: .78rem; color: var(--paper); padding: .4rem .6rem; background: rgba(245,242,236,.03); }

  /* ── Notifications ── */
  .notif-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
  .notif {
    border: 1px solid rgba(245,242,236,.08); padding: 2rem;
    position: relative; overflow: hidden;
    transition: border-color .25s;
  }
  .notif:hover { border-color: rgba(200,82,42,.35); }
  .notif::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    opacity: 0; transition: opacity .25s;
  }
  .notif:hover::before { opacity: 1; }
  .notif-icon { font-size: 1.5rem; color: var(--accent); margin-bottom: 1.25rem; }
  .notif h4 { font-family: var(--serif); font-size: 1.1rem; font-weight: 400; color: var(--paper); margin-bottom: .75rem; }
  .notif ul { list-style: none; display: flex; flex-direction: column; gap: .4rem; }
  .notif li { font-size: .82rem; color: var(--muted); display: flex; align-items: center; gap: .5rem; }
  .notif li::before { content: '—'; color: var(--accent); font-family: var(--mono); font-size: .7rem; }
  .notif p { font-size: .85rem; color: var(--muted); line-height: 1.65; }

  /* ── Project detail mock ── */
  .mock {
    border: 1px solid rgba(245,242,236,.1);
    background: rgba(245,242,236,.02);
  }
  .mock-tabs { display: flex; border-bottom: 1px solid rgba(245,242,236,.08); }
  .mock-tab {
    padding: .9rem 1.5rem; font-family: var(--mono); font-size: .72rem;
    letter-spacing: .06em; text-transform: uppercase; color: var(--muted);
    cursor: pointer; border-bottom: 2px solid transparent;
    transition: all .2s;
  }
  .mock-tab:hover { color: var(--paper); }
  .mock-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .mock-body { display: grid; grid-template-columns: 1fr 280px; }
  .mock-main { padding: 2rem; border-right: 1px solid rgba(245,242,236,.08); }
  .mock-block { margin-bottom: 1.5rem; }
  .mock-block h4 { font-family: var(--serif); font-size: 1.1rem; font-weight: 400; color: var(--paper); margin-bottom: .4rem; }
  .mock-block p { font-size: .85rem; color: var(--muted); }
  .status-rows { display: flex; flex-direction: column; gap: .65rem; margin-top: 1.25rem; }
  .status-row { display: flex; align-items: center; gap: .75rem; font-size: .85rem; color: var(--muted); }
  .sdot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .sdot-ok   { background: #28c840; }
  .sdot-warn { background: var(--gold); }
  .sdot-info { background: #5ba4ef; }
  .mock-aside { padding: 2rem; }
  .aside-row { display: flex; justify-content: space-between; align-items: baseline; padding: .7rem 0; border-bottom: 1px solid rgba(245,242,236,.06); }
  .aside-k { font-family: var(--mono); font-size: .68rem; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); }
  .aside-v { font-size: .85rem; color: var(--paper); }
  .aside-v-high { color: var(--accent); }

  /* ── Health ── */
  .health-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
  .health-card {
    border: 1px solid rgba(245,242,236,.08); padding: 2.5rem;
    display: flex; flex-direction: column; align-items: center; gap: 1.25rem;
    transition: border-color .25s, transform .25s var(--ease);
  }
  .health-card:hover { border-color: rgba(200,82,42,.35); transform: translateY(-4px); }
  .ring {
    width: 110px; height: 110px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    position: relative;
  }
  .ring-excellent { box-shadow: 0 0 0 2px #28c840, 0 0 30px rgba(40,200,64,.2); }
  .ring-good      { box-shadow: 0 0 0 2px var(--gold), 0 0 30px rgba(212,168,75,.2); }
  .ring-warn      { box-shadow: 0 0 0 2px var(--accent), 0 0 30px rgba(200,82,42,.2); }
  .ring-num { font-family: var(--serif); font-size: 2.25rem; color: var(--paper); }
  .ring-label { font-family: var(--mono); font-size: .7rem; letter-spacing: .08em; text-transform: uppercase; }
  .ring-excellent + .ring-label { color: #28c840; }
  .ring-good      + .ring-label { color: var(--gold); }
  .ring-warn      + .ring-label { color: var(--accent); }
  .ring-name { font-size: .85rem; color: var(--muted); }

  /* ── CTA ── */
  .cta-section {
    padding: 120px 0;
    position: relative; overflow: hidden;
    text-align: center;
    border-top: 1px solid var(--border);
  }
  .cta-bg {
    position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(ellipse 60% 50% at 50% 50%, rgba(200,82,42,.07), transparent);
  }
  .cta-h2 { font-family: var(--serif); font-size: clamp(2rem,3.5vw,3.25rem); font-weight: 400; color: var(--paper); margin-bottom: 1rem; line-height: 1.15; }
  .cta-h2 em { color: var(--accent); font-style: italic; }
  .cta-sub { font-size: 1rem; color: var(--muted); max-width: 480px; margin: 0 auto 2.5rem; line-height: 1.7; }
  .cta-actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }

  /* ── Footer ── */
  .footer { padding: 2rem 0; border-top: 1px solid var(--border); }
  .footer-inner { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
  .footer-links { display: flex; gap: 1.5rem; align-items: center; }
  .footer a { font-family: var(--mono); font-size: .72rem; letter-spacing: .05em; color: var(--muted); text-decoration: none; transition: color .2s; }
  .footer a:hover { color: var(--paper); }
  .footer-sep { color: var(--border); }
  .footer-copy { font-family: var(--mono); font-size: .72rem; color: var(--muted); }

  /* ── Social proof ── */
  .social { padding: 3.5rem 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
  .social-inner { display: flex; align-items: center; gap: 3rem; flex-wrap: wrap; }
  .social-label { font-family: var(--mono); font-size: .7rem; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); white-space: nowrap; }
  .social-pills { display: flex; gap: .75rem; flex-wrap: wrap; }
  .social-pill {
    font-family: var(--mono); font-size: .72rem; letter-spacing: .06em;
    padding: .35rem .9rem; border: 1px solid rgba(245,242,236,.15);
    color: var(--paper); transition: border-color .2s, color .2s;
  }
  .social-pill:hover { border-color: var(--accent); color: var(--accent); }

  /* ── Animations ── */
  .fade-up { opacity: 0; transform: translateY(24px); transition: opacity .6s var(--ease), transform .6s var(--ease); }
  .fade-up.visible { opacity: 1; transform: none; }
  .fade-up:nth-child(2) { transition-delay: .1s; }
  .fade-up:nth-child(3) { transition-delay: .2s; }

  @media (max-width: 900px) {
    .hero-inner { grid-template-columns: 1fr; }
    .hero-visual { display: none; }
    .features-grid, .views-split, .notif-grid, .health-grid { grid-template-columns: 1fr; }
    .mock-body { grid-template-columns: 1fr; }
    .mock-aside { border-top: 1px solid rgba(245,242,236,.08); }
    .nav-links { display: none; }
  }
`;

/* ─── Check icon ─── */
const Check = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/* ─── Fade-up hook ─── */
function useFadeUp(ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add("visible"); obs.disconnect(); }
    }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function FadeSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useFadeUp(ref);
  return <div ref={ref} className={`fade-up ${className}`}>{children}</div>;
}

/* ─── Main Component ─── */
export default function LandingPage() {
  const [activeTab, setActiveTab] = useState("Overview");
  const tabs = ["Overview", "Tasks", "Deliverables", "Emails", "Timeline"];

  return (
    <>
      <style>{css}</style>
      <div className="lp">

        {/* Nav */}
        <nav className="nav">
          <div className="wrap nav-inner">
            <a href="/" className="nav-logo">
              <div className="nav-logo-mark">PM</div>
              Project Manager
            </a>
            <ul className="nav-links">
              {["Features","Workflow","Views","Notifications","Security"].map(l => (
                <li key={l}><a href={`#${l.toLowerCase()}`}>{l}</a></li>
              ))}
            </ul>
            <div className="nav-cta">
              <a href="/signup" className="btn btn-ghost">Request Access</a>
              <a href="/login" className="btn btn-solid">Log In</a>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="hero">
          <div className="hero-grid" />
          <div className="hero-accent-bar" />
          <div className="wrap hero-inner">
            <div className="hero-left">
              <div className="hero-eyebrow">
                <span className="hero-eyebrow-line" />
                Built for IRCH workflows
              </div>
              <h1 className="hero-h1">
                Manage every client project —<br />
                from <em>onboarding</em> to launch.
              </h1>
              <p className="hero-sub">
                Track stages, assign tasks, monitor revisions, send client emails,
                and keep your entire team aligned — without spreadsheets or chaos.
              </p>
              <div className="hero-actions">
                <a href="/login" className="btn btn-solid btn-lg">
                  <Check /> Open Dashboard
                </a>
                <button className="btn btn-ghost btn-lg" type="button">
                  ▷&nbsp; Watch 60-sec demo
                </button>
              </div>
              <div className="hero-metrics">
                {[["1","Source of truth per project"],["0","Missed handoffs with rules"],["24/7","Visibility across stages"]].map(([v,l]) => (
                  <div key={l}>
                    <div className="metric-val">{v}</div>
                    <div className="metric-label">{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Frame visual */}
            <div className="hero-visual">
              <div className="frame">
                <div className="frame-chrome">
                  <span className="dot dot-r"/><span className="dot dot-y"/><span className="dot dot-g"/>
                  <div className="frame-title">Project Pipeline</div>
                  <div className="live-chip"><span className="live-dot"/>Live</div>
                </div>
                <div className="frame-body">
                  <div className="stage-row">
                    {["Onboarding","Copy","Copy Rev."].map((s,i) => (
                      <div className="stage-col" key={s}>
                        <div className="stage-head">{s}</div>
                        {i === 0 && <div className="card">
                          <div className="card-top"><span className="client">ICON</span><span className="tag tag-high">High</span></div>
                          <div className="card-days">2 days in stage</div>
                          <div className="card-email">Last emailed: 1 day ago</div>
                        </div>}
                        {i === 1 && <div className="card">
                          <div className="card-top"><span className="client">STAR</span><span className="tag tag-med">Med</span></div>
                          <div className="card-days">5 days in stage</div>
                          <div className="card-email">Last emailed: 2 days ago</div>
                        </div>}
                        {i === 2 && <div className="empty-col">empty</div>}
                      </div>
                    ))}
                  </div>
                  <div className="stage-row">
                    {["Design","Design Rev.","Dev"].map((s,i) => (
                      <div className="stage-col" key={s}>
                        <div className="stage-head">{s}</div>
                        {i === 0 && <div className="card">
                          <div className="card-top"><span className="client">Katalyst</span><span className="tag tag-high">High</span></div>
                          <div className="card-days">3 days in stage</div>
                          <div className="card-email hot">Last emailed: Today</div>
                        </div>}
                        {i !== 0 && <div className="empty-col">empty</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Social proof */}
        <div className="social">
          <div className="wrap social-inner">
            <span className="social-label">Trusted clients</span>
            <div className="social-pills">
              {["IRCH – ICON","IRCH – STAR","Katalyst","Private"].map(p => (
                <div className="social-pill" key={p}>{p}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Features */}
        <section id="features" className="section">
          <div className="wrap">
            <FadeSection>
              <div className="section-head">
                <span className="section-eyebrow">Core features</span>
                <h2 className="h2">Clarity, speed, and <em>accountability</em>.</h2>
                <p className="sub">Everything your PMs need to keep delivery tight — without chasing.</p>
              </div>
            </FadeSection>
            <div className="features-grid">
              {[
                ["01","Workflow Clarity","Stage-based tracking","Move projects smoothly from Copy → Design → Dev with clear ownership and approvals."],
                ["02","Client Email Timeline","Never lose the thread","Automatically logs the last time a client was emailed, what was sent, and by whom."],
                ["03","Revisions & Deliverables","Revision-proof delivery","Track revision rounds and deliverables (Logo, Brand Book, Landing Page) without manual checking."],
              ].map(([n,t,k,b]) => (
                <div className="feat" key={n}>
                  <div className="feat-num">{n}</div>
                  <h3>{t}</h3>
                  <div className="feat-kicker">{k}</div>
                  <p>{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Views */}
        <section id="views" className="section section-alt">
          <div className="wrap">
            <FadeSection>
              <div className="section-head">
                <span className="section-eyebrow">Two views</span>
                <h2 className="h2">Kanban for flow. <em>List view</em> for control.</h2>
                <p className="sub">Fast execution in boards — precise reporting in lists.</p>
              </div>
            </FadeSection>
            <div className="views-split">
              <div className="panel">
                <div className="panel-head">
                  <h3>Kanban View</h3>
                  <span className="chip">Operations</span>
                </div>
                <ul className="check-list">
                  {["Drag & drop stages","Visible bottlenecks","Fast daily standups"].map(i => (
                    <li key={i}><span className="check-icon"><Check/></span>{i}</li>
                  ))}
                </ul>
                <div className="mini-board">
                  {["Onboarding","Copy","Design","Dev"].map(p => <div className="mini-pill" key={p}>{p}</div>)}
                </div>
              </div>
              <div className="panel">
                <div className="panel-head">
                  <h3>List View</h3>
                  <span className="chip">Reporting</span>
                </div>
                <ul className="check-list">
                  {["Filter by PM","Filter by priority","Sort by days in stage","Export monthly close report"].map(i => (
                    <li key={i}><span className="check-icon"><Check/></span>{i}</li>
                  ))}
                </ul>
                <div className="mini-table">
                  {["Project","PM","Priority","Days","ICON","Sarah","High","2"].map((c,i) => (
                    <div className={i < 4 ? "mini-th" : "mini-td"} key={i}>{c}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section id="notifications" className="section">
          <div className="wrap">
            <FadeSection>
              <div className="section-head">
                <span className="section-eyebrow">Notifications</span>
                <h2 className="h2">Stay updated without <em>chasing</em> people.</h2>
                <p className="sub">The system nudges the right person at the right moment.</p>
              </div>
            </FadeSection>
            <div className="notif-grid">
              <div className="notif">
                <div className="notif-icon">✉</div>
                <h4>Email alerts for:</h4>
                <ul><li>Task assignments</li><li>@mentions</li><li>Client approvals needed</li></ul>
              </div>
              <div className="notif">
                <div className="notif-icon">◈</div>
                <h4>Daily digest (optional)</h4>
                <p>Get a clean summary of updates across all projects in one place.</p>
              </div>
              <div className="notif">
                <div className="notif-icon">⚠</div>
                <h4>Stuck-stage alerts</h4>
                <p>Know when something needs attention — before it slips through the cracks.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Project detail */}
        <section className="section section-alt">
          <div className="wrap">
            <FadeSection>
              <div className="section-head">
                <span className="section-eyebrow">Project detail</span>
                <h2 className="h2">Every project has one <em>source of truth</em>.</h2>
                <p className="sub">Tabs for execution. Sidebar for status. No guesswork.</p>
              </div>
            </FadeSection>
            <div className="mock">
              <div className="mock-tabs">
                {tabs.map(t => (
                  <div key={t} className={`mock-tab ${activeTab === t ? "active" : ""}`} onClick={() => setActiveTab(t)}>{t}</div>
                ))}
              </div>
              <div className="mock-body">
                <div className="mock-main">
                  <div className="mock-block">
                    <h4>Project Details</h4>
                    <p>All project context and next actions in one place.</p>
                  </div>
                  <div className="status-rows">
                    <div className="status-row"><span className="sdot sdot-ok"/>Milestones mapped to stages</div>
                    <div className="status-row"><span className="sdot sdot-warn"/>Overdue tasks highlighted automatically</div>
                    <div className="status-row"><span className="sdot sdot-info"/>Client comms logged to timeline</div>
                  </div>
                </div>
                <aside className="mock-aside">
                  {[["Priority","High",true],["PM","Sarah Chen"],["Stage","Design"],["Days in stage","3"],["Last emailed","Today"]].map((item) => {
                    const [k, v, hi] = item;
                    return (
                      <div className="aside-row" key={k as string}>
                        <span className="aside-k">{k}</span>
                        <span className={`aside-v ${hi ? "aside-v-high" : ""}`}>{v}</span>
                      </div>
                    );
                  })}
                </aside>
              </div>
            </div>
          </div>
        </section>

        {/* Health scores */}
        <section className="section">
          <div className="wrap">
            <FadeSection>
              <div className="section-head">
                <span className="section-eyebrow">Health scoring</span>
                <h2 className="h2">Project <em>Health Score</em></h2>
                <p className="sub">Scores use days in stage, overdue tasks, revision count, and days since last client email.</p>
              </div>
            </FadeSection>
            <div className="health-grid">
              {[
                ["95","Excellent","Katalyst Project","ring-excellent"],
                ["78","Good","ICON Project","ring-good"],
                ["62","Needs Attention","STAR Project","ring-warn"],
              ].map(([num,label,name,cls]) => (
                <div className="health-card" key={name}>
                  <div className={`ring ${cls}`}><span className="ring-num">{num}</span></div>
                  <div className={`ring-label`} style={{color: cls==="ring-excellent"?"#28c840":cls==="ring-good"?"#d4a84b":"#c8522a"}}>{label}</div>
                  <div className="ring-name">{name}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="cta-section">
          <div className="cta-bg"/>
          <div className="wrap">
            <h2 className="cta-h2">Ready to run projects like a <em>premium agency</em>?</h2>
            <p className="cta-sub">Ship faster, reduce revision loops, and keep clients warm — without chaos.</p>
            <div className="cta-actions">
              <a href="/login" className="btn btn-solid btn-lg">Go to Dashboard</a>
              <a href="/signup" className="btn btn-ghost btn-lg">Create New Project</a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="footer">
          <div className="wrap footer-inner">
            <div className="footer-links">
              <span style={{fontFamily:"var(--mono)",fontSize:".72rem",color:"var(--muted)"}}>v1.0.0</span>
              <span className="footer-sep">·</span>
              <a href="mailto:support@katalystpm.com">Support</a>
              <span className="footer-sep">·</span>
              <a href="#bug">Report a bug</a>
            </div>
            <div className="footer-copy">© 2024 Katalyst Project Management</div>
          </div>
        </footer>

      </div>
    </>
  );
}
