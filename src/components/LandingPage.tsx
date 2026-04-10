import { useState, useEffect, useRef } from "react";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Geist:wght@200;300;400;500;600&family=JetBrains+Mono:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --blue:        #0055FF;
    --blue-lt:     #2d7aff;
    --blue-dim:    rgba(0,85,255,0.12);
    --blue-glow:   rgba(0,85,255,0.3);
    --blue-border: rgba(0,85,255,0.45);
    --black:       #000;
    --off:         #070707;
    --s1:          #0e0e0e;
    --s2:          #141414;
    --w:           #fff;
    --w80:         rgba(255,255,255,0.8);
    --w50:         rgba(255,255,255,0.5);
    --w30:         rgba(255,255,255,0.3);
    --w12:         rgba(255,255,255,0.12);
    --w06:         rgba(255,255,255,0.06);
    --w03:         rgba(255,255,255,0.03);
    --border:      rgba(255,255,255,0.1);
    --display:     'Geist', sans-serif;
    --mono:        'JetBrains Mono', monospace;
    --ease:        cubic-bezier(0.16,1,0.3,1);
  }

  html { scroll-behavior: smooth; }
  body { background: var(--black); color: var(--w); font-family: var(--display); -webkit-font-smoothing: antialiased; overflow-x: hidden; }
  .lp { overflow-x: hidden; }
  .wrap { max-width: 1300px; margin: 0 auto; padding: 0 2.5rem; }

  /* ── NAV ── */
  .nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 300;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(20px) saturate(1.6);
    border-bottom: 1px solid var(--w06);
  }
  .nav-inner {
    display: flex; align-items: center; height: 58px;
    justify-content: space-between; gap: 2rem;
  }
  .nav-logo { display: flex; align-items: center; gap: .65rem; text-decoration: none; }
  .nav-logo img { height: 26px; width: auto; display: block; }
  .nav-logo-text {
    font-family: var(--display); font-weight: 500; font-size: .9rem;
    letter-spacing: .18em; text-transform: uppercase; color: var(--w);
  }
  .nav-links { display: flex; gap: 2.5rem; list-style: none; }
  .nav-links a {
    font-family: var(--mono); font-size: .65rem; letter-spacing: .09em;
    text-transform: uppercase; color: var(--w50); text-decoration: none; transition: color .15s;
  }
  .nav-links a:hover { color: var(--w); }
  .nav-right { display: flex; gap: .65rem; align-items: center; }

  .btn {
    display: inline-flex; align-items: center; gap: .4rem;
    font-family: var(--mono); font-size: .68rem; font-weight: 400;
    letter-spacing: .08em; text-transform: uppercase; text-decoration: none;
    cursor: pointer; border: none; transition: all .2s var(--ease);
    white-space: nowrap; line-height: 1;
  }
  .btn-ghost {
    background: transparent; color: var(--w50);
    border: 1px solid var(--w12); padding: .52rem 1.15rem;
  }
  .btn-ghost:hover { color: var(--w); border-color: var(--w30); }
  .btn-blue {
    background: var(--blue); color: var(--w);
    padding: .54rem 1.35rem;
    box-shadow: 0 0 20px var(--blue-glow);
  }
  .btn-blue:hover { background: var(--blue-lt); box-shadow: 0 0 32px rgba(0,85,255,0.5); transform: translateY(-1px); }
  .btn-lg  { padding: .82rem 2rem;   font-size: .72rem; }
  .btn-xl  { padding: .92rem 2.25rem; font-size: .74rem; }

  /* ── HERO ── */
  .hero {
    position: relative; min-height: 100vh;
    display: flex; align-items: center;
    overflow: hidden; padding-top: 58px;
  }

  /* Full-bleed background image */
  .hero-bg {
    position: absolute; inset: 0; z-index: 0;
    background-image: url('https://katalyst-crm.com/wp-content/uploads/2024/10/Katalyst-Project-2.1.png');
    background-size: cover;
    background-position: center right;
    background-repeat: no-repeat;
  }
  /* Dark overlay — heavier on left so text reads, lighter on right to show image */
  .hero-overlay {
    position: absolute; inset: 0; z-index: 1;
    background: linear-gradient(
      105deg,
      rgba(0,0,0,0.96) 0%,
      rgba(0,0,0,0.88) 35%,
      rgba(0,0,0,0.55) 60%,
      rgba(0,0,0,0.25) 100%
    );
  }
  /* Blue tint wash on right */
  .hero-tint {
    position: absolute; inset: 0; z-index: 2;
    background: linear-gradient(
      105deg,
      transparent 40%,
      rgba(0,55,180,0.12) 100%
    );
  }
  /* Scan lines */
  .hero-lines {
    position: absolute; inset: 0; z-index: 3; pointer-events: none;
    background: repeating-linear-gradient(
      0deg, transparent, transparent 3px,
      rgba(0,85,255,0.018) 3px, rgba(0,85,255,0.018) 4px
    );
  }
  /* Animated beam */
  .hero-beam {
    position: absolute; left: 0; right: 0; height: 1px; z-index: 4; pointer-events: none;
    background: linear-gradient(90deg, transparent 0%, rgba(0,85,255,0.55) 40%, rgba(0,85,255,0.55) 60%, transparent 100%);
    animation: beam 5s linear infinite;
  }
  @keyframes beam { 0%{top:58px;opacity:0} 3%{opacity:1} 97%{opacity:1} 100%{top:100%;opacity:0} }

  /* Dot grid fading in from right */
  .hero-dots {
    position: absolute; inset: 0; z-index: 3; pointer-events: none;
    background-image: radial-gradient(circle, rgba(0,85,255,0.22) 1px, transparent 1px);
    background-size: 38px 38px;
    mask-image: linear-gradient(90deg, transparent 30%, rgba(0,0,0,0.5) 60%, black 100%);
  }

  /* Content */
  .hero-content {
    position: relative; z-index: 10;
    width: 100%; padding: 5rem 0;
  }
  .hero-content .wrap {}

  .hero-label {
    display: inline-flex; align-items: center; gap: .6rem;
    font-family: var(--mono); font-size: .62rem; letter-spacing: .14em;
    text-transform: uppercase; color: var(--blue);
    margin-bottom: 2.25rem;
  }
  .hl-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--blue); animation: blink 2.5s ease-in-out infinite; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
  .hl-rule { width: 24px; height: 1px; background: var(--blue); opacity: .5; }

  .hero-h1 {
    font-family: var(--display);
    font-weight: 200;
    font-size: clamp(3.8rem, 6.5vw, 7.5rem);
    line-height: 1.0;
    letter-spacing: -.03em;
    color: var(--w);
    margin-bottom: 0;
    max-width: 680px;
  }
  .hero-h1 .blue { color: var(--blue); font-weight: 300; }

  .hero-rule { width: 40px; height: 1px; background: rgba(0,85,255,0.5); margin: 2.25rem 0; }

  .hero-sub {
    font-size: 1rem; font-weight: 300; line-height: 1.75;
    color: var(--w50); max-width: 440px; margin-bottom: 2.75rem;
  }
  .hero-sub strong { color: var(--w80); font-weight: 400; }

  .hero-actions { display: flex; gap: .85rem; flex-wrap: wrap; margin-bottom: 4rem; }

  .hero-stats { display: flex; gap: 2.5rem; }
  .hs-divider { width: 1px; background: var(--w12); align-self: stretch; }
  .hs-val {
    font-family: var(--display); font-weight: 200;
    font-size: 2.2rem; line-height: 1; color: var(--w);
    letter-spacing: -.03em;
  }
  .hs-val b { color: var(--blue); font-weight: 300; }
  .hs-label {
    font-family: var(--mono); font-size: .58rem; color: var(--w50);
    letter-spacing: .09em; text-transform: uppercase;
    margin-top: .3rem; line-height: 1.5;
  }

  /* Small floating card bottom-right of hero */
  .hero-card {
    position: absolute; bottom: 3rem; right: 3rem; z-index: 10;
    background: rgba(0,0,0,0.72); border: 1px solid var(--blue-border);
    padding: .85rem 1.15rem; backdrop-filter: blur(12px);
    display: flex; align-items: center; gap: .85rem;
  }
  .hc-live { display: flex; align-items: center; gap: .35rem; font-family: var(--mono); font-size: .58rem; color: #22c55e; letter-spacing: .07em; margin-bottom: .2rem; }
  .hc-dot  { width: 5px; height: 5px; border-radius: 50%; background: #22c55e; animation: blink 2s infinite; }
  .hc-val  { font-family: var(--display); font-weight: 200; font-size: 1.75rem; color: var(--blue); letter-spacing: -.03em; line-height: 1; }
  .hc-label{ font-family: var(--mono); font-size: .58rem; color: var(--w50); letter-spacing: .07em; text-transform: uppercase; margin-top: .15rem; }
  .hc-sep  { width: 1px; height: 36px; background: var(--blue-border); }

  /* ── TICKER ── */
  .ticker { overflow: hidden; border-top: 1px solid var(--w06); border-bottom: 1px solid var(--w06); background: var(--off); }
  .ticker-track { display: flex; width: max-content; animation: tick 24s linear infinite; }
  @keyframes tick { to { transform: translateX(-50%); } }
  .tick-item {
    display: flex; align-items: center; gap: 1.2rem;
    padding: .8rem 2rem; border-right: 1px solid var(--w06);
    font-family: var(--mono); font-size: .64rem; letter-spacing: .1em;
    text-transform: uppercase; color: var(--w30); white-space: nowrap;
  }
  .tick-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--blue); flex-shrink: 0; }

  /* ── SECTION BASE ── */
  .section { padding: 110px 0; }
  .section-alt { background: var(--off); }
  .sh { margin-bottom: 3.75rem; }
  .sh.c { text-align: center; }
  .sh.c .sub { margin: 0 auto; }
  .eyebrow {
    display: inline-flex; align-items: center; gap: .5rem;
    font-family: var(--mono); font-size: .62rem; letter-spacing: .14em;
    text-transform: uppercase; color: var(--blue); margin-bottom: 1.15rem;
  }
  .eyebrow::before { content: '//'; opacity: .35; }
  .h2 {
    font-family: var(--display); font-weight: 200;
    font-size: clamp(2.2rem, 3.8vw, 3.6rem);
    line-height: 1.0; letter-spacing: -.03em; color: var(--w); margin-bottom: .7rem;
  }
  .h2 em { color: var(--blue); font-style: normal; font-weight: 300; }
  .sub { font-size: .92rem; font-weight: 300; color: var(--w50); max-width: 500px; line-height: 1.78; }

  /* ── FEATURES ── */
  .feat-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1px; background: var(--w06); }
  .fc {
    background: var(--black); padding: 2.5rem;
    position: relative; overflow: hidden; transition: background .2s;
  }
  .fc::after {
    content:''; position:absolute; bottom:0; left:0; right:0; height:1px;
    background: var(--blue); transform: scaleX(0); transform-origin: left;
    transition: transform .4s var(--ease);
  }
  .fc:hover { background: var(--s1); }
  .fc:hover::after { transform: scaleX(1); }
  .fc.wide { grid-column: span 2; }
  .fc-num {
    font-family: var(--mono); font-size: .55rem; letter-spacing: .14em;
    color: var(--blue); opacity: .6; margin-bottom: 1.5rem;
    display: flex; align-items: center; gap: .5rem;
  }
  .fc-num::after { content:''; flex:1; height:1px; background: linear-gradient(90deg,var(--blue-border),transparent); }
  .fc-icon {
    width: 38px; height: 38px; border: 1px solid var(--blue-border);
    background: var(--blue-dim); display: flex; align-items: center;
    justify-content: center; font-size: .9rem; margin-bottom: 1.1rem;
  }
  .fc h3 {
    font-family: var(--display); font-weight: 400;
    font-size: 1.2rem; letter-spacing: -.02em; color: var(--w); margin-bottom: .28rem;
  }
  .fc-kicker {
    font-family: var(--mono); font-size: .57rem; letter-spacing: .1em;
    color: var(--blue); margin-bottom: .65rem; opacity: .7;
  }
  .fc p { font-size: .85rem; font-weight: 300; color: var(--w50); line-height: 1.72; }
  .fc-tags { display: flex; flex-wrap: wrap; gap: .3rem; margin-top: 1.15rem; }
  .ftag {
    font-family: var(--mono); font-size: .54rem; letter-spacing: .06em;
    padding: .15rem .45rem; border: 1px solid var(--blue-border);
    color: var(--blue); background: var(--blue-dim);
  }

  /* ── WORKFLOW ── */
  .wf-grid { display: grid; grid-template-columns: 5fr 4fr; gap: 5rem; align-items: start; }
  .wf-steps { margin-top: 2rem; }
  .wf-step {
    display: grid; grid-template-columns: 2.2rem 1fr; gap: 1rem;
    padding: 1.25rem 0; border-bottom: 1px solid var(--w06);
  }
  .wf-step:last-child { border-bottom: none; }
  .wf-n {
    font-family: var(--mono); font-size: .6rem; font-weight: 400;
    color: var(--blue); opacity: .5; padding-top: .1rem; letter-spacing: .08em;
  }
  .wf-step h5 { font-family: var(--display); font-weight: 400; font-size: .88rem; color: var(--w80); margin-bottom: .15rem; letter-spacing: -.01em; }
  .wf-step p  { font-size: .78rem; font-weight: 300; color: var(--w50); line-height: 1.6; }

  /* Pipeline */
  .pipeline { border: 1px solid var(--w06); background: var(--s1); position: relative; }
  .pipeline::before { content:''; position:absolute; top:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,var(--blue),transparent); opacity:.6; }
  .pl-chrome { display:flex; align-items:center; gap:.55rem; padding:.65rem .9rem; border-bottom:1px solid var(--w06); background:var(--s2); }
  .pdot { width:6px; height:6px; border-radius:50%; }
  .pd-r{background:#ff5f57;} .pd-y{background:#febc2e;} .pd-g{background:#28c840;}
  .pl-title { flex:1; text-align:center; font-family:var(--mono); font-size:.58rem; color:var(--w30); letter-spacing:.08em; }
  .pl-live  { display:flex; align-items:center; gap:.3rem; font-family:var(--mono); font-size:.55rem; color:#22c55e; letter-spacing:.06em; }
  .pll-dot  { width:4px; height:4px; border-radius:50%; background:#22c55e; animation:blink 2s infinite; }
  .pl-body  { padding:.75rem; display:grid; grid-template-columns:repeat(3,1fr); gap:.4rem; }
  .pl-ch    { font-family:var(--mono); font-size:.52rem; letter-spacing:.1em; text-transform:uppercase; color:var(--w30); padding-bottom:.4rem; border-bottom:1px solid var(--w06); margin-bottom:.35rem; }
  .pcard    { background:var(--s2); border:1px solid var(--w06); padding:.58rem; margin-bottom:.3rem; transition:border-color .2s; }
  .pcard:hover { border-color:var(--blue-border); }
  .pcard-top{ display:flex; justify-content:space-between; align-items:center; margin-bottom:.25rem; }
  .pcard-n  { font-family:var(--mono); font-size:.6rem; color:var(--w80); }
  .pprio    { font-family:var(--mono); font-size:.5rem; letter-spacing:.05em; padding:.07rem .26rem; border:1px solid; }
  .pprio.hi { color:var(--blue); border-color:var(--blue-border); background:var(--blue-dim); }
  .pprio.md { color:rgba(255,193,7,.8); border-color:rgba(255,193,7,.3); background:rgba(255,193,7,.07); }
  .pcard-m  { font-size:.56rem; font-weight:300; color:var(--w30); margin-bottom:.1rem; }
  .pcard-e  { font-family:var(--mono); font-size:.52rem; color:var(--w30); }
  .pcard-e.hot { color:#22c55e; }
  .pempty   { border:1px dashed rgba(255,255,255,.04); height:50px; display:flex; align-items:center; justify-content:center; font-family:var(--mono); font-size:.52rem; color:rgba(255,255,255,.08); }

  /* ── ROLES ── */
  .roles-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:var(--w06); }
  .role-card { background:var(--black); padding:2rem; text-align:center; transition:background .2s; position:relative; overflow:hidden; }
  .role-card::before { content:''; position:absolute; inset:0; background:var(--blue-dim); opacity:0; transition:opacity .3s var(--ease); }
  .role-card:hover { background:var(--s1); }
  .role-card:hover::before { opacity:1; }
  .role-inner { position:relative; z-index:1; }
  .role-ico { width:44px; height:44px; border:1px solid var(--blue-border); background:var(--blue-dim); display:flex; align-items:center; justify-content:center; font-size:.95rem; margin:0 auto .95rem; }
  .role-card h4 { font-family:var(--display); font-weight:400; font-size:.9rem; letter-spacing:-.01em; color:var(--w); margin-bottom:.28rem; }
  .role-card p  { font-size:.75rem; font-weight:300; color:var(--w50); line-height:1.6; }

  /* ── DETAIL + CHAT ── */
  .dc-split { display:grid; grid-template-columns:1fr 1fr; gap:1px; background:var(--w06); }
  .dc-l { background:var(--black); }
  .dc-r { background:var(--black); display:flex; flex-direction:column; }

  .m-tabs { display:flex; border-bottom:1px solid var(--w06); overflow-x:auto; }
  .m-tab {
    padding:.75rem 1.25rem; font-family:var(--mono); font-size:.6rem; letter-spacing:.07em;
    text-transform:uppercase; color:var(--w30); cursor:pointer;
    border-bottom:1px solid transparent; transition:all .15s; white-space:nowrap;
  }
  .m-tab:hover { color:var(--w50); }
  .m-tab.active { color:var(--blue); border-bottom-color:var(--blue); }
  .m-body { display:grid; grid-template-columns:1fr 210px; }
  .m-main { padding:1.6rem; border-right:1px solid var(--w06); }
  .m-main h4 { font-family:var(--display); font-weight:400; font-size:1rem; color:var(--w); margin-bottom:.7rem; letter-spacing:-.02em; }
  .srows { display:flex; flex-direction:column; gap:.48rem; }
  .srow  { display:flex; align-items:center; gap:.5rem; font-size:.76rem; font-weight:300; color:var(--w50); }
  .sdot  { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
  .s-ok{background:#22c55e;} .s-w{background:#f59e0b;} .s-b{background:var(--blue);}
  .m-aside { padding:1.6rem; }
  .arow { display:flex; justify-content:space-between; align-items:baseline; padding:.5rem 0; border-bottom:1px solid var(--w03); }
  .akey { font-family:var(--mono); font-size:.56rem; letter-spacing:.09em; text-transform:uppercase; color:var(--w30); }
  .aval { font-size:.76rem; font-weight:300; color:var(--w80); }
  .av-b{color:var(--blue);} .av-ok{color:#22c55e;}

  .ch-head { display:flex; align-items:center; justify-content:space-between; padding:.82rem 1.35rem; border-bottom:1px solid var(--w06); }
  .ch-hl { display:flex; align-items:center; gap:.5rem; }
  .ch-name { font-family:var(--mono); font-size:.66rem; color:var(--w80); }
  .ch-chan { font-family:var(--mono); font-size:.56rem; color:var(--w30); }
  .ch-cnt  { font-family:var(--mono); font-size:.56rem; color:var(--w30); }
  .ch-msgs { flex:1; padding:1.15rem 1.35rem; display:flex; flex-direction:column; gap:.55rem; }
  .cmsg    { display:flex; gap:.45rem; }
  .cmsg.me { flex-direction:row-reverse; }
  .cav { width:20px; height:20px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:.5rem; font-weight:500; font-family:var(--mono); }
  .cav-t{background:rgba(0,85,255,.18);color:var(--blue);}
  .cav-m{background:var(--w06);color:var(--w50);}
  .cbub { max-width:80%; padding:.45rem .72rem; font-size:.75rem; font-weight:300; line-height:1.55; }
  .cmsg.them .cbub { background:var(--s2); color:var(--w80); border:1px solid var(--w06); }
  .cmsg.me   .cbub { background:rgba(0,85,255,.12); color:var(--w80); border:1px solid var(--blue-border); }
  .ch-input { display:flex; align-items:center; gap:.4rem; padding:.78rem 1.35rem; border-top:1px solid var(--w06); background:var(--s1); }
  .chi-f { flex:1; font-family:var(--mono); font-size:.64rem; color:var(--w30); letter-spacing:.04em; }
  .chi-s { font-family:var(--mono); font-size:.58rem; color:var(--blue); letter-spacing:.06em; }

  /* ── NOTIF ── */
  .notif-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:var(--w06); }
  .notif { background:var(--black); padding:2.25rem; position:relative; overflow:hidden; transition:background .2s; }
  .notif::before { content:''; position:absolute; top:0; left:0; width:1px; height:0; background:var(--blue); transition:height .4s var(--ease); }
  .notif:hover { background:var(--s1); }
  .notif:hover::before { height:100%; }
  .notif-ico { font-size:1.1rem; margin-bottom:.95rem; }
  .notif h4 { font-family:var(--display); font-weight:400; font-size:1rem; color:var(--w); margin-bottom:.6rem; letter-spacing:-.02em; }
  .notif ul { list-style:none; display:flex; flex-direction:column; gap:.28rem; }
  .notif li { font-size:.77rem; font-weight:300; color:var(--w50); display:flex; align-items:center; gap:.42rem; }
  .notif li::before { content:''; width:3px; height:3px; border-radius:50%; background:var(--blue); flex-shrink:0; opacity:.6; }

  /* ── HEALTH ── */
  .health-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1.25rem; }
  .hcard { border:1px solid var(--w06); padding:2.5rem; text-align:center; background:var(--s1); display:flex; flex-direction:column; align-items:center; gap:1.1rem; transition:border-color .2s, transform .25s var(--ease); }
  .hcard:hover { transform:translateY(-4px); border-color:var(--blue-border); }
  .hring { width:100px; height:100px; border-radius:50%; display:flex; align-items:center; justify-content:center; }
  .hr-ok   { box-shadow:0 0 0 1.5px #22c55e, 0 0 20px rgba(34,197,94,.14); }
  .hr-good { box-shadow:0 0 0 1.5px #f59e0b, 0 0 20px rgba(245,158,11,.14); }
  .hr-warn { box-shadow:0 0 0 1.5px var(--blue), 0 0 20px var(--blue-glow); }
  .hring-num { font-family:var(--display); font-weight:200; font-size:2.1rem; color:var(--w); letter-spacing:-.03em; }
  .hring-st  { font-family:var(--mono); font-size:.6rem; letter-spacing:.1em; text-transform:uppercase; }
  .hs-ok{color:#22c55e;} .hs-g{color:#f59e0b;} .hs-b{color:var(--blue);}
  .hring-name { font-size:.78rem; font-weight:300; color:var(--w50); }

  /* ── CTA ── */
  .cta { padding:130px 0; text-align:center; position:relative; overflow:hidden; border-top:1px solid var(--w06); }
  .cta-glow { position:absolute; inset:0; pointer-events:none; background:radial-gradient(ellipse 50% 50% at 50% 80%,rgba(0,85,255,.1),transparent); }
  .cta-wm {
    position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
    font-family:var(--display); font-weight:200;
    font-size:clamp(6rem,16vw,18rem); color:transparent;
    -webkit-text-stroke:1px rgba(0,85,255,.05);
    letter-spacing:-.04em; pointer-events:none; white-space:nowrap; user-select:none;
  }
  .cta h2 { font-family:var(--display); font-weight:200; font-size:clamp(2.8rem,5.5vw,5.8rem); line-height:.96; letter-spacing:-.04em; color:var(--w); margin-bottom:1.1rem; position:relative; z-index:1; }
  .cta h2 .cb { color:var(--blue); font-weight:300; }
  .cta-sub { font-size:.95rem; font-weight:300; color:var(--w50); max-width:400px; margin:0 auto 2.75rem; line-height:1.78; position:relative; z-index:1; }
  .cta-acts { display:flex; gap:.85rem; justify-content:center; flex-wrap:wrap; position:relative; z-index:1; }

  /* ── FOOTER ── */
  .footer { padding:1.75rem 0; border-top:1px solid var(--w06); }
  .footer-inner { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; }
  .flinks { display:flex; gap:1.5rem; align-items:center; }
  .footer a { font-family:var(--mono); font-size:.6rem; letter-spacing:.05em; color:var(--w30); text-decoration:none; transition:color .15s; }
  .footer a:hover { color:var(--w50); }
  .fsep { color:var(--w06); }
  .fcopy { font-family:var(--mono); font-size:.6rem; color:var(--w30); }

  /* ── FU ── */
  .fu { opacity:0; transform:translateY(20px); transition:opacity .65s var(--ease),transform .65s var(--ease); }
  .fu.in { opacity:1; transform:none; }
  .fu.d1{transition-delay:.1s;} .fu.d2{transition-delay:.2s;} .fu.d3{transition-delay:.3s;}

  /* ── RESPONSIVE ── */
  @media (max-width:1024px) {
    .feat-grid { grid-template-columns:1fr 1fr; }
    .fc.wide { grid-column:span 2; }
    .wf-grid { grid-template-columns:1fr; }
    .roles-grid { grid-template-columns:repeat(2,1fr); }
    .dc-split { grid-template-columns:1fr; }
    .notif-grid { grid-template-columns:1fr; }
    .health-grid { grid-template-columns:1fr; }
    .nav-links { display:none; }
    .hero-card { display:none; }
  }
  @media (max-width:640px) {
    .feat-grid { grid-template-columns:1fr; }
    .fc.wide { grid-column:span 1; }
    .roles-grid { grid-template-columns:1fr 1fr; }
    .m-body { grid-template-columns:1fr; }
    .hero-stats { gap:1.5rem; }
    .hero-h1 { font-size:clamp(3rem,10vw,5rem); }
  }
`;

function useFU(ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add("in"); obs.disconnect(); }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function FU({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useFU(ref);
  return <div ref={ref} className={`fu ${className}`}>{children}</div>;
}

export default function KatalystLanding() {
  const [activeTab, setActiveTab] = useState("Overview");
  const tabs = ["Overview", "Tasks", "Deliverables", "Emails", "Timeline"];

  const features = [
    { num:"01", wide:true,  icon:"⬡", title:"Projects & Stages", kicker:"FULL LIFECYCLE · CRUD · ARCHIVE · ACTIVITY",  body:"Track every client project from onboarding to launch. Move through Kanban stages, manage team assignments, and keep a full activity log. Archive completed work without losing history.", tags:["CRUD","Stage control","Archiving","Activity log"] },
    { num:"02", wide:false, icon:"◻", title:"Tasks",              kicker:"ASSIGN · STATUS · Q&A · COMMENTS",             body:"Create, assign, and status-track tasks with built-in Q&A and comment threads per task.", tags:["Assign","Comments","Q&A"] },
    { num:"03", wide:false, icon:"△", title:"Deliverables",       kicker:"STATUS · HISTORY · TEAM",                      body:"Track every deliverable — Logo, Brand Book, Home Page — with status updates, ownership, and full version history.", tags:["Status","History","Team"] },
    { num:"04", wide:false, icon:"○", title:"Client Updates",     kicker:"FORMS · UPLOADS · SUBMISSIONS",                body:"Send client-facing updates, publish forms, collect submissions and file uploads, track client comments directly in the platform.", tags:["Publish","Forms","Uploads"] },
    { num:"05", wide:false, icon:"◈", title:"Live Chat",          kicker:"REAL-TIME · ROOMS · @MENTIONS",                body:"Rooms per project or team. Real-time messages. Stop chasing people on WhatsApp.", tags:["Rooms","Real-time"] },
    { num:"06", wide:false, icon:"✦", title:"Emails",             kicker:"SEND · LOG · THREAD",                          body:"Send and list all client emails in context. Know exactly when a client was last contacted and what was said.", tags:["Send","Thread log"] },
  ];

  const roles = [
    { icon:"⬡", title:"Head PM",    body:"Full access — projects, team, clients, settings." },
    { icon:"◻", title:"Designer",   body:"Assigned projects, design deliverables, collaboration." },
    { icon:"△", title:"Developer",  body:"Dev stage, task updates, file uploads." },
    { icon:"○", title:"Copywriter", body:"Copy tasks, deliverable submissions, client comments." },
    { icon:"◈", title:"CRM",        body:"Client updates, email logs, comms history." },
    { icon:"✦", title:"SEO",        body:"SEO deliverables, task comments, assigned projects." },
    { icon:"⊞", title:"Team Lead",  body:"Manage assignments, approve deliverables." },
    { icon:"⬭", title:"Client",     body:"View updates, submit forms, upload files." },
  ];

  const tItems = ["Projects","Tasks","Deliverables","Client Updates","Live Chat","Emails","Roles","Kanban","Notifications","Health Scores"];

  return (
    <>
      <style>{css}</style>
      <div className="lp">

        {/* NAV */}
        <nav className="nav">
          <div className="wrap nav-inner">
            <a href="/" className="nav-logo">
              <img src="https://katalyst-crm.com/wp-content/uploads/2024/09/K-1.png" alt="Katalyst"
                onError={(e)=>{ (e.target as HTMLImageElement).style.display="none"; }}/>
              <span className="nav-logo-text">Katalyst</span>
            </a>
            <ul className="nav-links">
              {["Features","Workflow","Roles","Notifications"].map(l=>(
                <li key={l}><a href={`#${l.toLowerCase()}`}>{l}</a></li>
              ))}
            </ul>
            <div className="nav-right">
              <a href="/rapid-prospect-onboarding" className="btn btn-ghost">Onboarding</a>
              <a href="/signup" className="btn btn-ghost">Sign Up</a>
              <a href="/login"  className="btn btn-blue">Log In</a>
            </div>
          </div>
        </nav>

        {/* HERO */}
        <section className="hero">
          {/* Layers */}
          <div className="hero-bg"/>
          <div className="hero-overlay"/>
          <div className="hero-tint"/>
          <div className="hero-lines"/>
          <div className="hero-beam"/>
          <div className="hero-dots"/>

          {/* Text content */}
          <div className="hero-content">
            <div className="wrap">
              <div className="hero-label">
                <span className="hl-dot"/>
                <span className="hl-rule"/>
                Internal Platform · v2.0
              </div>

              <h1 className="hero-h1">
                Every project.<br/>
                Every team.<br/>
                <span className="blue">One tool.</span>
              </h1>

              <div className="hero-rule"/>

              <p className="hero-sub">
                <strong>Tasks, deliverables, client updates,<br/>live chat, emails</strong> — and full Kanban workflow.<br/>
                Built for how Katalyst actually works.
              </p>

              <div className="hero-actions">
                <a href="/login"  className="btn btn-blue btn-xl">Open Dashboard →</a>
                <button className="btn btn-ghost btn-lg" type="button">▷ Quick Demo</button>
              </div>

              <div className="hero-stats">
                <div>
                  <div className="hs-val">10<b>+</b></div>
                  <div className="hs-label">User roles</div>
                </div>
                <div className="hs-divider"/>
                <div>
                  <div className="hs-val">9</div>
                  <div className="hs-label">Workflow stages</div>
                </div>
                <div className="hs-divider"/>
                <div>
                  <div className="hs-val">RT</div>
                  <div className="hs-label">Live chat</div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating card */}
          <div className="hero-card">
            <div>
              <div className="hc-live"><span className="hc-dot"/>Live</div>
              <div className="hc-val">12</div>
              <div className="hc-label">Active projects</div>
            </div>
            <div className="hc-sep"/>
            <div>
              <div style={{fontFamily:"var(--mono)",fontSize:".56rem",color:"var(--w50)",letterSpacing:".07em",textTransform:"uppercase",marginBottom:".18rem"}}>Handoffs missed</div>
              <div className="hc-val" style={{color:"#22c55e"}}>0</div>
            </div>
          </div>
        </section>

        {/* TICKER */}
        <div className="ticker">
          <div className="ticker-track">
            {[...tItems,...tItems].map((item,i)=>(
              <div className="tick-item" key={i}><span className="tick-dot"/>{item}</div>
            ))}
          </div>
        </div>

        {/* FEATURES */}
        <section id="features" className="section">
          <div className="wrap">
            <FU>
              <div className="sh c">
                <span className="eyebrow">Core modules</span>
                <h2 className="h2">Built for real <em>agency work.</em></h2>
                <p className="sub">Not a generic PM tool. Every feature designed for how creative agencies move — fast, client-facing, revision-heavy.</p>
              </div>
            </FU>
            <div className="feat-grid">
              {features.map(f=>(
                <div key={f.num} className={`fc ${f.wide?"wide":""}`}>
                  <div className="fc-num">{f.num}</div>
                  <div className="fc-icon">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <div className="fc-kicker">{f.kicker}</div>
                  <p>{f.body}</p>
                  <div className="fc-tags">{f.tags.map(t=><span key={t} className="ftag">{t}</span>)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WORKFLOW */}
        <section id="workflow" className="section section-alt">
          <div className="wrap">
            <div className="wf-grid">
              <FU>
                <span className="eyebrow">Kanban workflow</span>
                <h2 className="h2">Onboarding to launch —<br/><em>one flow.</em></h2>
                <p className="sub">Drag and drop. See where everything is. No spreadsheets, no lost handoffs.</p>
                <div className="wf-steps">
                  {[
                    ["01","Onboarding",            "Client brief, contracts, access setup"],
                    ["02","Copy & Copy Revisions",  "Copywriting drafts, client review loops"],
                    ["03","Design & Revisions",     "Visual assets, brand, feedback rounds"],
                    ["04","Development",            "Build, QA, client walkthroughs"],
                    ["05","Launch & Close",          "Go-live, final deliverables, archive"],
                  ].map(([n,t,b])=>(
                    <div className="wf-step" key={n}>
                      <div className="wf-n">{n}</div>
                      <div><h5>{t}</h5><p>{b}</p></div>
                    </div>
                  ))}
                </div>
              </FU>
              <FU className="d1">
                <div className="pipeline">
                  <div className="pl-chrome">
                    <span className="pdot pd-r"/><span className="pdot pd-y"/><span className="pdot pd-g"/>
                    <div className="pl-title">Project Pipeline</div>
                    <div className="pl-live"><span className="pll-dot"/>Live</div>
                  </div>
                  <div className="pl-body">
                    {[
                      {s:"Onboarding",n:"ICON",    p:"hi",pl:"High",d:"2 days",e:"Emailed: 1d ago",hot:false},
                      {s:"Copy",      n:"STAR",    p:"md",pl:"Med", d:"5 days",e:"Emailed: 2d ago",hot:false},
                      {s:"Design",    n:"Katalyst",p:"hi",pl:"High",d:"3 days",e:"Emailed: Today", hot:true},
                    ].map(c=>(
                      <div key={c.s}>
                        <div className="pl-ch">{c.s}</div>
                        <div className="pcard">
                          <div className="pcard-top"><span className="pcard-n">{c.n}</span><span className={`pprio ${c.p}`}>{c.pl}</span></div>
                          <div className="pcard-m">{c.d}</div>
                          <div className={`pcard-e ${c.hot?"hot":""}`}>{c.e}</div>
                        </div>
                      </div>
                    ))}
                    {["Copy Rev.","Design Rev.","Dev"].map(s=>(
                      <div key={s}><div className="pl-ch">{s}</div><div className="pempty">—</div></div>
                    ))}
                  </div>
                </div>
              </FU>
            </div>
          </div>
        </section>

        {/* ROLES */}
        <section id="roles" className="section">
          <div className="wrap">
            <FU>
              <div className="sh c">
                <span className="eyebrow">User roles</span>
                <h2 className="h2">Right access. <em>Right people.</em></h2>
                <p className="sub">Role-based permissions so each team member sees exactly what they need — nothing more.</p>
              </div>
            </FU>
            <div className="roles-grid">
              {roles.map((r,i)=>(
                <FU key={r.title} className={`d${(i%4) as 0|1|2|3}`}>
                  <div className="role-card">
                    <div className="role-inner">
                      <div className="role-ico">{r.icon}</div>
                      <h4>{r.title}</h4>
                      <p>{r.body}</p>
                    </div>
                  </div>
                </FU>
              ))}
            </div>
          </div>
        </section>

        {/* DETAIL + CHAT */}
        <section className="section section-alt">
          <div className="wrap">
            <FU>
              <div className="sh c">
                <span className="eyebrow">Project detail</span>
                <h2 className="h2">One project. <em>One truth.</em></h2>
                <p className="sub">Tabs for execution. Sidebar for status. Live chat built right in.</p>
              </div>
            </FU>
            <div className="dc-split">
              <div className="dc-l">
                <div className="m-tabs">
                  {tabs.map(t=>(
                    <div key={t} className={`m-tab ${activeTab===t?"active":""}`} onClick={()=>setActiveTab(t)}>{t}</div>
                  ))}
                </div>
                <div className="m-body">
                  <div className="m-main">
                    <h4>ICON — Website Redesign</h4>
                    <div className="srows">
                      <div className="srow"><span className="sdot s-ok"/>Milestones mapped to stages</div>
                      <div className="srow"><span className="sdot s-w"/>2 tasks overdue — action needed</div>
                      <div className="srow"><span className="sdot s-b"/>Client email logged today</div>
                      <div className="srow"><span className="sdot s-ok"/>Logo deliverable: approved</div>
                    </div>
                  </div>
                  <aside className="m-aside">
                    {[["Priority","High","av-b"],["PM","Sarah C.",""],["Stage","Design",""],["Days","3",""],["Emailed","Today","av-ok"],["Health","87 · Good","av-b"]].map(([k,v,c])=>(
                      <div className="arow" key={k}><span className="akey">{k}</span><span className={`aval ${c}`}>{v}</span></div>
                    ))}
                  </aside>
                </div>
              </div>
              <div className="dc-r">
                <div className="ch-head">
                  <div className="ch-hl">
                    <div className="pl-live"><span className="pll-dot"/></div>
                    <div><div className="ch-name">ICON Project Chat</div><div className="ch-chan"># design-handoff</div></div>
                  </div>
                  <span className="ch-cnt">3 online</span>
                </div>
                <div className="ch-msgs">
                  {[
                    {av:"SC",me:false,text:"Homepage mockup is ready for review — shared in deliverables."},
                    {av:"MJ",me:true, text:"Looks great. Sending to client now and logging the email."},
                    {av:"DK",me:false,text:"Mobile version needs one more pass before we submit."},
                    {av:"MJ",me:true, text:"Assigned to you as task #14. Priority: high."},
                  ].map((m,i)=>(
                    <div key={i} className={`cmsg ${m.me?"me":"them"}`}>
                      <div className={`cav ${m.me?"cav-m":"cav-t"}`}>{m.av}</div>
                      <div className="cbub">{m.text}</div>
                    </div>
                  ))}
                </div>
                <div className="ch-input">
                  <span className="chi-f">Message #design-handoff…</span>
                  <span className="chi-s">SEND ↗</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* NOTIFICATIONS */}
        <section id="notifications" className="section">
          <div className="wrap">
            <FU>
              <div className="sh c">
                <span className="eyebrow">Notifications</span>
                <h2 className="h2">Know what matters. <em>Now.</em></h2>
                <p className="sub">The right person gets nudged at the right moment. Nothing slips.</p>
              </div>
            </FU>
            <div className="notif-grid">
              {[
                {ico:"✉",title:"Email Alerts",   items:["Task assignments","@mentions in comments","Client approvals needed","Stuck-stage warnings"]},
                {ico:"◈",title:"In-App Badges",  items:["Unread count on bell","Mark all as read","Per-project filtering","Priority flagging"]},
                {ico:"⚡",title:"Live Chat Pings",items:["Real-time notifications","Room-level muting","@mention highlights","File share alerts"]},
              ].map(n=>(
                <div className="notif" key={n.title}>
                  <div className="notif-ico">{n.ico}</div>
                  <h4>{n.title}</h4>
                  <ul>{n.items.map(i=><li key={i}>{i}</li>)}</ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HEALTH */}
        <section className="section section-alt">
          <div className="wrap">
            <FU>
              <div className="sh c">
                <span className="eyebrow">Health scoring</span>
                <h2 className="h2">Project <em>Health Score</em></h2>
                <p className="sub">Scored by days in stage, overdue tasks, revision count, and days since last client email.</p>
              </div>
            </FU>
            <div className="health-grid">
              {[
                {num:"95",ring:"hr-ok",  st:"hs-ok",label:"Excellent",      name:"Katalyst Project"},
                {num:"78",ring:"hr-good",st:"hs-g", label:"Good",           name:"ICON Project"},
                {num:"62",ring:"hr-warn",st:"hs-b", label:"Needs Attention",name:"STAR Project"},
              ].map(h=>(
                <div key={h.name} className="hcard">
                  <div className={`hring ${h.ring}`}><span className="hring-num">{h.num}</span></div>
                  <div className={`hring-st ${h.st}`}>{h.label}</div>
                  <div className="hring-name">{h.name}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="cta">
          <div className="cta-glow"/>
          <div className="cta-wm">KATALYST</div>
          <div className="wrap">
            <FU>
              <h2>Run projects like<br/><span className="cb">Katalyst.</span></h2>
              <p className="cta-sub">Every task. Every client. Every team member. One platform that actually works.</p>
              <div className="cta-acts">
                <a href="/login"  className="btn btn-blue btn-xl">Open Dashboard →</a>
                <a href="/signup" className="btn btn-ghost btn-lg">Create New Project</a>
              </div>
            </FU>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="footer">
          <div className="wrap footer-inner">
            <div className="flinks">
              <span style={{fontFamily:"var(--mono)",fontSize:".58rem",color:"var(--w30)"}}>v2.0.0</span>
              <span className="fsep">·</span>
              <a href="mailto:support@katalyst-crm.com">Support</a>
              <span className="fsep">·</span>
              <a href="#bug">Report a bug</a>
              <span className="fsep">·</span>
              <button type="button" className="footer-link-btn" style={{background:'none',border:'none',padding:0,font: 'inherit', color: 'inherit', cursor: 'pointer', textDecoration: 'underline'}}>Privacy</button>
            </div>
            <div className="fcopy">© 2025 Katalyst · Internal Platform</div>
          </div>
        </footer>

      </div>
    </>
  );
}