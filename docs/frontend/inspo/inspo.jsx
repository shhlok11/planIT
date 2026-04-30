import { useState, useEffect, useRef, useMemo, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   planIT  ·  Aceternity-style UI showcase
   Includes hand-rolled versions of:
   • Aurora Background           • Spotlight / cursor glow
   • Lamp hero effect            • Beam border (conic sweep)
   • 3-D tilt card               • Glowing card grid
   • Typewriter text             • Floating dock nav
   • Bento grid                  • Background grid pattern
   • Split-flap number ticker    • Sparkles overlay
   • Text gradient shimmer       • Pulse dot / status
═══════════════════════════════════════════════════════════════════════ */

// ─── Data ────────────────────────────────────────────────────────────────
const TODAY = new Date("2026-04-29T09:00:00");
const iso = (d) => { const dt = new Date(TODAY); dt.setDate(dt.getDate() + d); return dt.toISOString().slice(0, 10); };
let _id = 100;
const ev = (cid, title, type, days, weight) => ({ id: ++_id, course_id: cid, title, type, date: iso(days), weight });

const COURSES = [
  { id: 1, code: "CS 374", name: "Algorithms", rank: 1, diff: 5, color: "#a78bfa", events: [ev(1,"PS4: Dynamic Programming","assignment",3,8), ev(1,"Midterm Exam 2","exam",9,25), ev(1,"Final Exam","exam",45,35)] },
  { id: 2, code: "CS 411", name: "Database Systems", rank: 2, diff: 4, color: "#38bdf8", events: [ev(2,"MP3: Query Optimizer","project",4,12), ev(2,"Midterm Exam","exam",10,20), ev(2,"Final Project Demo","project",42,20)] },
  { id: 3, code: "STAT 410", name: "Statistics II", rank: 3, diff: 4, color: "#fbbf24", events: [ev(3,"Homework 6","assignment",2,5), ev(3,"Midterm 2","exam",16,22), ev(3,"Final Exam","exam",47,30)] },
  { id: 4, code: "PHIL 270", name: "Ethics & Engineering", rank: 4, diff: 2, color: "#34d399", events: [ev(4,"Reading Response 5","assignment",5,4), ev(4,"Essay 2","assignment",19,15), ev(4,"Final Paper","assignment",40,30)] },
];
const CONFLICTS = [
  { id:"c1", severity:"high", msg:"Two exams within 48 hrs", event_ids:[102,107] },
  { id:"c2", severity:"medium", msg:"Lab, exam & quiz same week", event_ids:[106,107,108] },
  { id:"c3", severity:"high", msg:"Three finals in same window", event_ids:[104,110,115] },
];
const allEvents = COURSES.flatMap(c => c.events);
const scores = COURSES.flatMap(c => c.events.map(e => {
  const days = e.date ? Math.round((new Date(e.date) - TODAY) / 86400000) : null;
  const urgency = days != null ? Math.max(0, Math.min(35, 35 - days * 0.6)) : 10;
  const score = Math.min(100, Math.round(urgency + (5 - c.rank) * 4 + c.diff * 2.4 + (e.weight ?? 0) * 0.18 + {exam:12,project:9,assignment:7,lab:5,quiz:4}[e.type]));
  return { ...e, course_code: c.code, color: c.color, score, days };
})).sort((a, b) => b.score - a.score);

// ─── Keyframes injected once ──────────────────────────────────────────────
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:99px}
@keyframes aurora{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
@keyframes beam{to{--ba:360deg}}
@property --ba{syntax:"<angle>";initial-value:0deg;inherits:false}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
@keyframes ping{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.4);opacity:0}}
@keyframes shimmer{to{background-position:200% center}}
@keyframes flap{0%{transform:rotateX(0deg)}50%{transform:rotateX(-90deg)}100%{transform:rotateX(0deg)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes sparkle{0%,100%{opacity:0;transform:scale(0)}30%{opacity:1;transform:scale(1)}70%{opacity:1;transform:scale(1)}}
@keyframes gradShift{0%{background-position:0% 50%}100%{background-position:200% 50%}}
@keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}
`;

// ─── Shared helpers ───────────────────────────────────────────────────────
const mono = { fontFamily:"'JetBrains Mono',monospace" };
const display = { fontFamily:"'Syne',system-ui,sans-serif", letterSpacing:"-0.02em" };
const C = {
  bg:"#080810", card:"rgba(14,12,28,0.7)", border:"rgba(255,255,255,0.07)",
  fg:"#f0eeff", muted:"#7e7a9a", violet:"#a78bfa", cyan:"#38bdf8",
  amber:"#fbbf24", red:"#f87171", green:"#34d399", blue:"#818cf8",
};

function GlowText({ children, gradient = `${C.cyan},${C.violet}`, style = {} }) {
  return (
    <span style={{
      background: `linear-gradient(120deg, ${gradient}, ${C.fg} 80%, ${gradient})`,
      backgroundSize: "200% auto", WebkitBackgroundClip: "text", backgroundClip: "text",
      color: "transparent", animation: "shimmer 5s linear infinite", ...style,
    }}>{children}</span>
  );
}

function MonoTag({ children, color = C.muted, style = {} }) {
  return <span style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color, ...style }}>{children}</span>;
}

// ─── AURORA BACKGROUND ────────────────────────────────────────────────────
function AuroraBackground() {
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: "-50%", background: `conic-gradient(from 230.29deg at 51.63% 52.16%, rgb(36,0,255) 0deg, rgb(0,135,255) 67.5deg, rgb(108,39,157) 198.75deg, rgb(24,38,163) 251.25deg, rgb(54,103,196) 301.88deg, rgb(105,30,255) 360deg)`, backgroundSize: "200% 200%", animation: "aurora 12s ease infinite", opacity: 0.18, filter: "blur(60px)" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(120,50,255,0.25) 0%, transparent 70%)" }} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 60% 40% at 80% 90%, rgba(56,189,248,0.15) 0%, transparent 60%)` }} />
      {/* scanline */}
      <div style={{ position:"absolute", left:0, right:0, height:1, background:"rgba(255,255,255,0.015)", animation:"scanline 8s linear infinite", pointerEvents:"none" }} />
    </div>
  );
}

// ─── SPOTLIGHT CURSOR ─────────────────────────────────────────────────────
function SpotlightCursor() {
  const [pos, setPos] = useState({ x: -999, y: -999 });
  useEffect(() => {
    const move = (e) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none" }}>
      <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)`, transform: `translate(${pos.x - 300}px, ${pos.y - 300}px)`, transition: "transform 0.08s ease", willChange: "transform" }} />
    </div>
  );
}

// ─── BACKGROUND GRID ─────────────────────────────────────────────────────
function GridBackground({ children, style = {} }) {
  return (
    <div style={{ position: "relative", ...style }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`, backgroundSize: "40px 40px", zIndex: 0 }} />
      <div aria-hidden style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at center, transparent 40%, ${C.bg} 80%)`, zIndex: 1 }} />
      <div style={{ position: "relative", zIndex: 2 }}>{children}</div>
    </div>
  );
}

// ─── SPARKLES ─────────────────────────────────────────────────────────────
function Sparkles({ count = 12, style = {}, children }) {
  const sparks = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 3}s`, dur: `${1.2 + Math.random() * 2}s`,
    size: 3 + Math.random() * 4,
    color: [C.violet, C.cyan, C.amber, "#fff"][Math.floor(Math.random() * 4)],
  })), [count]);
  return (
    <div style={{ position: "relative", display: "inline-block", ...style }}>
      {sparks.map(s => (
        <div key={s.id} aria-hidden style={{ position: "absolute", top: s.top, left: s.left, width: s.size, height: s.size, borderRadius: "50%", background: s.color, boxShadow: `0 0 6px ${s.color}`, animation: `sparkle ${s.dur} ease-in-out infinite ${s.delay}`, pointerEvents: "none" }} />
      ))}
      {children}
    </div>
  );
}

// ─── 3-D TILT CARD ────────────────────────────────────────────────────────
function TiltCard({ children, style = {}, glowColor = C.violet }) {
  const ref = useRef();
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, mx: 50, my: 50 });
  const [hovered, setHovered] = useState(false);

  function onMove(e) {
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTilt({ rx: (y - 0.5) * -16, ry: (x - 0.5) * 16, mx: x * 100, my: y * 100 });
  }
  return (
    <div ref={ref} onMouseMove={onMove} onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setTilt({ rx:0, ry:0, mx:50, my:50 }); setHovered(false); }}
      style={{
        transform: hovered ? `perspective(800px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale3d(1.02,1.02,1.02)` : "perspective(800px) rotateX(0) rotateY(0) scale3d(1,1,1)",
        transition: "transform 0.18s ease", borderRadius: 16,
        background: C.card, border: `1px solid ${C.border}`,
        backdropFilter: "blur(20px)", position: "relative", overflow: "hidden",
        boxShadow: hovered ? `0 20px 60px -15px ${glowColor}55, 0 0 0 1px ${glowColor}22` : "0 4px 20px rgba(0,0,0,0.4)",
        ...style,
      }}>
      {/* inner spotlight */}
      {hovered && <div aria-hidden style={{ position:"absolute", width:300, height:300, borderRadius:"50%", background:`radial-gradient(circle, ${glowColor}18 0%, transparent 70%)`, left:`calc(${tilt.mx}% - 150px)`, top:`calc(${tilt.my}% - 150px)`, pointerEvents:"none", transition:"left 0.1s, top 0.1s" }} />}
      {children}
    </div>
  );
}

// ─── GLOWING CARD ─────────────────────────────────────────────────────────
function GlowingCard({ children, color = C.violet, style = {} }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 16, padding: "1px", transition: "all 0.3s",
        background: hovered ? `linear-gradient(135deg, ${color}88, transparent, ${color}44)` : C.border,
        boxShadow: hovered ? `0 0 30px -8px ${color}88` : "none",
        ...style,
      }}>
      <div style={{ background: C.card, borderRadius: 15, height: "100%", backdropFilter: "blur(16px)" }}>
        {children}
      </div>
    </div>
  );
}

// ─── BEAM BORDER ──────────────────────────────────────────────────────────
function BeamBorder({ children, style = {} }) {
  return (
    <div style={{ position: "relative", borderRadius: 20, ...style }}>
      <div aria-hidden style={{ position:"absolute", inset:-1, borderRadius:21, background:`conic-gradient(from var(--ba,0deg), transparent 0deg, ${C.violet} 30deg, ${C.cyan} 60deg, transparent 90deg)`, animation:"beam 4s linear infinite", WebkitMask:"linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0)", WebkitMaskComposite:"xor", maskComposite:"exclude", padding:1, zIndex:0 }} />
      <div style={{ position:"relative", zIndex:1 }}>{children}</div>
    </div>
  );
}

// ─── TYPEWRITER ───────────────────────────────────────────────────────────
function Typewriter({ words, speed = 80, pause = 1800 }) {
  const [wordIdx, setWordIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    const word = words[wordIdx % words.length];
    const delay = deleting ? speed / 2 : charIdx === word.length ? pause : speed;
    const t = setTimeout(() => {
      if (!deleting && charIdx < word.length) { setText(word.slice(0, charIdx + 1)); setCharIdx(c => c + 1); }
      else if (!deleting && charIdx === word.length) setDeleting(true);
      else if (deleting && charIdx > 0) { setText(word.slice(0, charIdx - 1)); setCharIdx(c => c - 1); }
      else { setDeleting(false); setWordIdx(w => w + 1); }
    }, delay);
    return () => clearTimeout(t);
  }, [charIdx, deleting, wordIdx, words, speed, pause]);

  return (
    <span>
      {text}
      <span style={{ borderRight: `2px solid ${C.violet}`, marginLeft: 2, animation: "ping 1s step-end infinite", display:"inline-block", width:0, height:"1em", verticalAlign:"text-bottom" }} />
    </span>
  );
}

// ─── SPLIT-FLAP TICKER ────────────────────────────────────────────────────
function SplitFlap({ value, style = {} }) {
  const [display, setDisplay] = useState(0);
  const [flapping, setFlapping] = useState(false);
  const prev = useRef(0);

  useEffect(() => {
    if (prev.current === value) return;
    setFlapping(true);
    const steps = 18, delta = (value - prev.current) / steps;
    let i = 0;
    const t = setInterval(() => {
      i++;
      setDisplay(v => Math.round(prev.current + delta * i));
      if (i >= steps) { clearInterval(t); setDisplay(value); prev.current = value; setFlapping(false); }
    }, 40);
    return () => clearInterval(t);
  }, [value]);

  return (
    <div style={{ display:"inline-block", ...mono, ...style }}>
      <span style={{ display:"inline-block", animation: flapping ? "flap 0.08s ease-in-out" : "none" }}>
        {display}
      </span>
    </div>
  );
}

// ─── LAMP EFFECT HERO ─────────────────────────────────────────────────────
function LampHero({ onEnter }) {
  const [clicked, setClicked] = useState(false);
  const words = ["Semester", "Deadlines", "Priorities", "Conflicts", "Schedule"];

  function go() { setClicked(true); setTimeout(onEnter, 700); }

  return (
    <GridBackground style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 20px", position:"relative", overflow:"hidden" }}>
      {/* Lamp cone */}
      <div aria-hidden style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", width:600, height:400, background:`conic-gradient(from 270deg at 50% 0%, transparent 20%, ${C.violet}22 35%, ${C.cyan}18 50%, ${C.violet}22 65%, transparent 80%)`, filter:"blur(2px)", pointerEvents:"none" }} />
      <div aria-hidden style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", width:2, height:200, background:`linear-gradient(to bottom, ${C.violet}, transparent)` }} />
      <div aria-hidden style={{ position:"absolute", top:200, left:"50%", transform:"translateX(-50%)", width:500, height:1, background:`radial-gradient(ellipse, ${C.violet}88, transparent 70%)` }} />

      <Sparkles count={20} style={{ position:"absolute", inset:0, width:"100%", height:"100%" }}><div /></Sparkles>

      <div style={{ textAlign:"center", position:"relative", zIndex:2, animation:"fadeUp 0.8s ease both" }}>
        <div style={{ display:"inline-flex", alignItems:"center", gap:8, border:`1px solid ${C.border}`, borderRadius:999, padding:"6px 16px", background:`rgba(167,139,250,0.08)`, backdropFilter:"blur(10px)", marginBottom:28 }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background:C.green, boxShadow:`0 0 8px ${C.green}`, display:"inline-block" }} />
          <MonoTag color={C.muted}>Beta · Fall 2026 cohort · {COURSES.length} courses loaded</MonoTag>
        </div>

        <h1 style={{ ...display, fontSize:"clamp(44px, 7vw, 80px)", fontWeight:800, color:C.fg, lineHeight:1.05, marginBottom:16 }}>
          Mission control<br />
          for your <GlowText>
            <Typewriter words={words} />
          </GlowText>
        </h1>

        <p style={{ color:C.muted, fontSize:17, maxWidth:500, margin:"0 auto 40px", lineHeight:1.7 }}>
          Drop in your syllabi. planIT extracts every deadline, computes priority scores, and surfaces conflicts — before they derail your semester.
        </p>

        {/* Stats row */}
        <div style={{ display:"flex", gap:24, justifyContent:"center", marginBottom:44, flexWrap:"wrap" }}>
          {[
            { label:"Deadlines tracked", val: allEvents.length, color: C.cyan },
            { label:"Conflicts detected", val: CONFLICTS.length, color: C.red },
            { label:"High-weight items", val: allEvents.filter(e=>(e.weight??0)>=20).length, color: C.amber },
          ].map(s => (
            <div key={s.label} style={{ textAlign:"center" }}>
              <div style={{ ...display, fontSize:36, fontWeight:800, color:s.color }}><SplitFlap value={s.val} /></div>
              <MonoTag>{s.label}</MonoTag>
            </div>
          ))}
        </div>

        <BeamBorder style={{ display:"inline-block" }}>
          <button onClick={go} disabled={clicked} style={{
            background: clicked ? `${C.violet}33` : `linear-gradient(135deg, ${C.violet}cc, ${C.cyan}88)`,
            border:"none", borderRadius:18, padding:"14px 36px", fontSize:15, fontWeight:600,
            color:"#fff", cursor:"pointer", ...display,
            boxShadow:`0 0 40px -10px ${C.violet}`, transition:"all 0.3s",
          }}>
            {clicked ? "Loading mission control…" : "Launch Dashboard →"}
          </button>
        </BeamBorder>
      </div>

      {/* Feature cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, maxWidth:600, width:"100%", marginTop:52, position:"relative", zIndex:2 }}>
        {[
          { n:"01", label:"Extract", desc:"Every deadline, weight, type", color:C.violet },
          { n:"02", label:"Score", desc:"Priority by urgency × impact", color:C.cyan },
          { n:"03", label:"Defend", desc:"Conflicts surfaced early", color:C.amber },
        ].map(f => (
          <TiltCard key={f.n} glowColor={f.color} style={{ padding:20 }}>
            <MonoTag color={C.muted}>{f.n}</MonoTag>
            <div style={{ ...display, fontWeight:700, fontSize:17, color:f.color, margin:"6px 0 4px" }}>{f.label}</div>
            <div style={{ fontSize:12, color:C.muted }}>{f.desc}</div>
          </TiltCard>
        ))}
      </div>
    </GridBackground>
  );
}

// ─── FLOATING DOCK NAV ────────────────────────────────────────────────────
function FloatingDock({ active, setActive }) {
  const items = [
    { id:"dashboard", icon:"⊞", label:"Dashboard" },
    { id:"courses", icon:"★", label:"Courses" },
    { id:"radar", icon:"◎", label:"Radar" },
    { id:"calendar", icon:"▦", label:"Calendar" },
    { id:"export", icon:"↓", label:"Export" },
  ];
  const [hoverId, setHoverId] = useState(null);

  return (
    <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", zIndex:100, display:"flex", alignItems:"flex-end", gap:6, padding:"8px 12px", background:"rgba(8,8,16,0.85)", border:`1px solid ${C.border}`, borderRadius:24, backdropFilter:"blur(30px)", boxShadow:`0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)` }}>
      {items.map(item => {
        const isActive = item.id === active;
        const isHover = item.id === hoverId;
        const scale = isHover ? 1.5 : isActive ? 1.25 : 1;
        return (
          <div key={item.id} style={{ position:"relative", display:"flex", flexDirection:"column", alignItems:"center" }} onMouseEnter={() => setHoverId(item.id)} onMouseLeave={() => setHoverId(null)}>
            {isHover && (
              <div style={{ position:"absolute", bottom:"100%", marginBottom:8, background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:"4px 10px", whiteSpace:"nowrap", fontSize:12, color:C.fg, backdropFilter:"blur(12px)", pointerEvents:"none" }}>
                {item.label}
              </div>
            )}
            <button onClick={() => setActive(item.id)} style={{
              width: 44 * scale, height: 44 * scale, borderRadius: 12 * scale,
              background: isActive ? `${C.violet}33` : isHover ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${isActive ? C.violet + "66" : C.border}`,
              boxShadow: isActive ? `0 0 20px -5px ${C.violet}` : "none",
              color: isActive ? C.violet : C.muted, fontSize: 18 * (scale * 0.7),
              cursor:"pointer", transition:"all 0.2s cubic-bezier(.34,1.56,.64,1)",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              {item.icon}
            </button>
            {isActive && <div style={{ width:4, height:4, borderRadius:"50%", background:C.violet, margin:"4px 0 0", boxShadow:`0 0 8px ${C.violet}` }} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── BENTO STAT CARD ─────────────────────────────────────────────────────
function StatCard({ label, value, color, icon, style={} }) {
  return (
    <GlowingCard color={color} style={style}>
      <div style={{ padding:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
          <MonoTag>{label}</MonoTag>
          <span style={{ fontSize:18, opacity:0.6 }}>{icon}</span>
        </div>
        <div style={{ ...display, fontSize:42, fontWeight:800, color }}><SplitFlap value={value} /></div>
      </div>
    </GlowingCard>
  );
}

// ─── COURSE GRID ──────────────────────────────────────────────────────────
function CourseGrid() {
  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ ...display, fontSize:24, fontWeight:700, color:C.fg, marginBottom:4 }}>
          <GlowText gradient={`${C.violet},${C.cyan}`}>Course Priority Board</GlowText>
        </h2>
        <MonoTag>Drag to reorder · stars set difficulty</MonoTag>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        {COURSES.map((c, i) => {
          const courseScores = scores.filter(s => s.course_id === c.id);
          const load = courseScores.reduce((sum, s) => sum + s.score, 0);
          return (
            <TiltCard key={c.id} glowColor={c.color} style={{ padding:20 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                <div style={{ width:40, height:40, borderRadius:10, background:`${c.color}22`, border:`1px solid ${c.color}44`, display:"flex", alignItems:"center", justifyContent:"center", ...mono, fontWeight:700, fontSize:14, color:c.color }}>
                  #{i + 1}
                </div>
                <div>
                  <div style={{ ...display, fontWeight:700, fontSize:15, color:C.fg }}>{c.code}</div>
                  <div style={{ fontSize:12, color:C.muted }}>{c.name}</div>
                </div>
                <div style={{ marginLeft:"auto", textAlign:"right" }}>
                  <MonoTag>load</MonoTag>
                  <div style={{ ...display, fontSize:22, fontWeight:800, color:c.color }}><SplitFlap value={load} /></div>
                </div>
              </div>
              {/* Difficulty stars */}
              <div style={{ display:"flex", gap:4, marginBottom:12 }}>
                {[1,2,3,4,5].map(n => (
                  <span key={n} style={{ fontSize:12, color: n <= c.diff ? C.amber : "rgba(255,255,255,0.12)", textShadow: n <= c.diff ? `0 0 8px ${C.amber}` : "none" }}>★</span>
                ))}
              </div>
              {/* Mini event list */}
              {c.events.slice(0, 3).map(ev => {
                const days = ev.date ? Math.round((new Date(ev.date) - TODAY) / 86400000) : null;
                const urgent = days != null && days <= 7;
                return (
                  <div key={ev.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 10px", borderRadius:8, background: urgent ? `${C.red}11` : "rgba(255,255,255,0.03)", border:`1px solid ${urgent ? C.red + "33" : C.border}`, marginBottom:4 }}>
                    <span style={{ fontSize:12, color: urgent ? C.red : C.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:160 }}>{ev.title}</span>
                    <span style={{ ...mono, fontSize:10, color: urgent ? C.red : C.muted, flexShrink:0, marginLeft:8 }}>{days != null ? `${days}d` : "—"}</span>
                  </div>
                );
              })}
            </TiltCard>
          );
        })}
      </div>
    </div>
  );
}

// ─── CONFLICT RADAR (SVG) ─────────────────────────────────────────────────
function ConflictRadarView() {
  const [hovered, setHovered] = useState(null);
  const SIZE = 340, CX = 170, CY = 170, R = 120;
  const polar = (deg) => ({ x: CX + R * Math.cos((deg * Math.PI) / 180), y: CY + R * Math.sin((deg * Math.PI) / 180) });
  const arcStr = (r) => { const s = { x: CX + r * Math.cos((135*Math.PI)/180), y: CY + r * Math.sin((135*Math.PI)/180) }; const e = { x: CX + r * Math.cos((405*Math.PI)/180), y: CY + r * Math.sin((405*Math.PI)/180) }; return `M ${s.x} ${s.y} A ${r} ${r} 0 1 1 ${e.x} ${e.y}`; };

  const evDates = allEvents.filter(e => e.date).map(e => new Date(e.date).getTime());
  const minD = Math.min(...evDates), maxD = Math.max(...evDates);
  const plotted = allEvents.filter(e => e.date).map(e => {
    const t = (new Date(e.date).getTime() - minD) / (maxD - minD);
    const deg = 135 + t * 270;
    const conflict = CONFLICTS.find(c => c.event_ids.includes(e.id));
    const course = COURSES.find(c => c.id === e.course_id);
    return { ...e, deg, conflict, courseColor: course?.color ?? C.cyan };
  });

  const todayT = Math.max(0, Math.min(1, (TODAY.getTime() - minD) / (maxD - minD)));
  const todayPos = polar(135 + todayT * 270);
  const hovEv = hovered != null ? plotted.find(p => p.id === hovered) : null;

  return (
    <div>
      <div style={{ marginBottom:16 }}>
        <h2 style={{ ...display, fontSize:24, fontWeight:700, color:C.fg, marginBottom:4 }}>
          <GlowText gradient={`${C.red},${C.amber}`}>Conflict Radar</GlowText>
        </h2>
        <div style={{ display:"flex", gap:12 }}>
          {[{label:"High", color:C.red},{label:"Medium",color:C.amber},{label:"Low",color:C.cyan}].map(s=>(
            <span key={s.label} style={{ display:"flex", alignItems:"center", gap:4 }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:s.color, display:"inline-block", boxShadow:`0 0 6px ${s.color}` }} />
              <MonoTag color={s.color}>{s.label}</MonoTag>
            </span>
          ))}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:24, alignItems:"start" }}>
        <div style={{ position:"relative" }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <defs>
              <radialGradient id="rg2" cx="50%" cy="50%">
                <stop offset="0%" stopColor="rgba(167,139,250,0.25)" />
                <stop offset="70%" stopColor="rgba(167,139,250,0.03)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
            </defs>
            <circle cx={CX} cy={CY} r={R} fill="url(#rg2)" />
            {[R-30, R, R+14].map((r,i) => <path key={i} d={arcStr(r)} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />)}
            <path d={arcStr(R)} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} strokeLinecap="round" />
            <path d={arcStr(R)} fill="none" stroke={C.violet} strokeWidth={1.5} strokeLinecap="round" strokeDasharray="3 8" opacity={0.5} />
            <line x1={CX} y1={CY} x2={todayPos.x} y2={todayPos.y} stroke={`${C.cyan}88`} strokeWidth={1} strokeDasharray="2 3" />
            <circle cx={todayPos.x} cy={todayPos.y} r={5} fill={C.cyan} style={{ filter:`drop-shadow(0 0 6px ${C.cyan})` }} />
            <text x={CX} y={CY - 8} textAnchor="middle" fill={C.muted} style={{ ...mono, fontSize:8 }}>TODAY</text>
            <text x={CX} y={CY + 7} textAnchor="middle" fill={C.fg} style={{ ...display, fontSize:13, fontWeight:700 }}>
              {TODAY.toLocaleDateString("en-US",{month:"short",day:"numeric"})}
            </text>
            {plotted.map(p => {
              const pos = polar(p.deg);
              const isConflict = !!p.conflict;
              const color = isConflict ? {high:C.red,medium:C.amber,low:C.cyan}[p.conflict.severity] : p.courseColor;
              return (
                <g key={p.id} onMouseEnter={() => setHovered(p.id)} onMouseLeave={() => setHovered(null)} style={{ cursor:"pointer" }}>
                  {isConflict && <circle cx={pos.x} cy={pos.y} r={12} fill={color} opacity={0.2} style={{ animation:"ping 2s ease-out infinite", transformOrigin:`${pos.x}px ${pos.y}px` }} />}
                  <circle cx={pos.x} cy={pos.y} r={hovered === p.id ? 7 : isConflict ? 5.5 : 3.5}
                    fill={color} stroke={hovered === p.id ? "#fff" : "transparent"} strokeWidth={1.5}
                    style={{ filter:`drop-shadow(0 0 4px ${color})`, transition:"r 0.15s" }} />
                </g>
              );
            })}
          </svg>
          {hovEv && (
            <div style={{ position:"absolute", bottom:0, left:"50%", transform:"translateX(-50%)", width:220, background:"rgba(10,8,22,0.97)", border:`1px solid ${C.border}`, borderRadius:12, padding:12, backdropFilter:"blur(20px)", zIndex:10, animation:"fadeUp 0.2s ease" }}>
              <MonoTag color={hovEv.courseColor}>{COURSES.find(c=>c.id===hovEv.course_id)?.code} · {hovEv.type}</MonoTag>
              <div style={{ ...display, fontWeight:600, fontSize:13, color:C.fg, margin:"4px 0 6px" }}>{hovEv.title}</div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:11, color:C.muted }}>{new Date(hovEv.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
                <span style={{ ...mono, fontSize:11, color:C.muted }}>{hovEv.weight}% weight</span>
              </div>
              {hovEv.conflict && <div style={{ marginTop:6, borderRadius:6, border:`1px solid ${C.red}44`, color:C.red, fontSize:10, padding:"3px 8px", ...mono }}>⚠ {hovEv.conflict.msg}</div>}
            </div>
          )}
        </div>

        {/* Conflict list */}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {CONFLICTS.map(c => {
            const sevColor = {high:C.red, medium:C.amber, low:C.cyan}[c.severity];
            return (
              <div key={c.id} style={{ borderRadius:12, border:`1px solid ${sevColor}33`, background:`${sevColor}09`, padding:"12px 14px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <span style={{ width:7, height:7, borderRadius:"50%", background:sevColor, boxShadow:`0 0 8px ${sevColor}`, display:"inline-block" }} />
                  <MonoTag color={sevColor}>{c.severity}</MonoTag>
                </div>
                <div style={{ fontSize:13, color:C.fg, marginBottom:6 }}>{c.msg}</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {c.event_ids.map(id => {
                    const ev = allEvents.find(e => e.id === id);
                    const course = COURSES.find(c => c.id === ev?.course_id);
                    if (!ev) return null;
                    return (
                      <span key={id} style={{ ...mono, fontSize:10, borderRadius:6, border:`1px solid ${course?.color ?? C.border}44`, background:`${course?.color ?? C.border}11`, color: course?.color ?? C.muted, padding:"2px 8px" }}>
                        {course?.code} · {ev.title.slice(0,20)}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── PRIORITY BARS ─────────────────────────────────────────────────────────
function PriorityView() {
  const top = scores.slice(0, 8);
  return (
    <div>
      <h2 style={{ ...display, fontSize:24, fontWeight:700, color:C.fg, marginBottom:4 }}>
        <GlowText gradient={`${C.amber},${C.violet}`}>Priority Breakdown</GlowText>
      </h2>
      <MonoTag style={{ display:"block", marginBottom:20 }}>Top deadlines ranked by composite score</MonoTag>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {top.map((s, i) => (
          <GlowingCard key={s.id} color={s.color} style={{}}>
            <div style={{ padding:"12px 16px" }}>
              <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:8 }}>
                <MonoTag color={C.muted} style={{ fontSize:9 }}>#{i + 1}</MonoTag>
                <span style={{ ...mono, fontSize:10, fontWeight:600, color:s.color }}>{s.course_code}</span>
                <span style={{ fontSize:13, color:C.fg, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.title}</span>
                <span style={{ ...display, fontWeight:800, fontSize:20, color: s.score > 65 ? C.red : C.fg }}>
                  <SplitFlap value={s.score} />
                </span>
              </div>
              <div style={{ display:"flex", height:5, borderRadius:99, overflow:"hidden", background:"rgba(255,255,255,0.05)" }}>
                <div style={{ width:`${s.score}%`, background:`linear-gradient(90deg, ${s.color}88, ${s.color})`, borderRadius:99, transition:"width 1s ease", boxShadow:`0 0 8px ${s.color}66` }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                {s.days != null && <MonoTag style={{ fontSize:9, color: s.days <= 5 ? C.red : C.muted }}>{s.days <= 0 ? "overdue" : `due in ${s.days}d`}</MonoTag>}
                <MonoTag style={{ fontSize:9 }}>{s.weight}% weight · {s.type}</MonoTag>
              </div>
            </div>
          </GlowingCard>
        ))}
      </div>
    </div>
  );
}

// ─── CALENDAR ─────────────────────────────────────────────────────────────
function CalendarView() {
  const [month, setMonth] = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
  const yr = month.getFullYear(), mo = month.getMonth();
  const grid = useMemo(() => {
    const cells = [];
    for (let i = 0; i < new Date(yr, mo, 1).getDay(); i++) cells.push(null);
    for (let d = 1; d <= new Date(yr, mo + 1, 0).getDate(); d++) cells.push(new Date(yr, mo, d));
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [yr, mo]);

  const byDate = useMemo(() => {
    const m = new Map();
    COURSES.forEach(c => c.events.forEach(ev => {
      if (!ev.date) return;
      const arr = m.get(ev.date) ?? [];
      arr.push({ ...ev, color: c.color, code: c.code });
      m.set(ev.date, arr);
    }));
    return m;
  }, []);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <h2 style={{ ...display, fontSize:24, fontWeight:700, color:C.fg, marginBottom:4 }}>
            <GlowText gradient={`${C.cyan},${C.green}`}>Mission Calendar</GlowText>
          </h2>
          <MonoTag>Full semester view · all deadlines mapped</MonoTag>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {["←","→"].map((arrow, i) => (
            <button key={arrow} onClick={() => setMonth(new Date(yr, mo + (i === 0 ? -1 : 1), 1))} style={{ background:"rgba(255,255,255,0.04)", border:`1px solid ${C.border}`, color:C.fg, borderRadius:8, width:36, height:36, cursor:"pointer", fontSize:14 }}>{arrow}</button>
          ))}
          <span style={{ ...display, fontWeight:600, fontSize:15, color:C.fg, minWidth:140, textAlign:"center" }}>{month.toLocaleDateString("en-US",{month:"long",year:"numeric"})}</span>
        </div>
      </div>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:18, padding:16, backdropFilter:"blur(20px)" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:8 }}>
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
            <div key={d} style={{ textAlign:"center", ...mono, fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase", color:C.muted, padding:"4px 0" }}>{d}</div>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
          {grid.map((date, i) => {
            const iso2 = date?.toISOString().slice(0,10);
            const evs = iso2 ? byDate.get(iso2) ?? [] : [];
            const isToday = date && date.toDateString() === TODAY.toDateString();
            const hasExam = evs.some(e => e.type === "exam");
            return (
              <div key={i} style={{ minHeight:80, borderRadius:10, border: date ? (isToday ? `1px solid ${C.violet}` : `1px solid ${C.border}`) : "1px solid transparent", background: date ? (isToday ? `${C.violet}15` : "rgba(255,255,255,0.02)") : "transparent", padding:6, boxShadow: isToday ? `0 0 20px -8px ${C.violet}` : "none" }}>
                {date && (
                  <>
                    <div style={{ ...mono, fontSize:10, color: isToday ? C.violet : C.muted, fontWeight: isToday ? 700 : 400, marginBottom:4 }}>{date.getDate()}</div>
                    {evs.slice(0,2).map(ev => (
                      <div key={ev.id} title={ev.title} style={{ fontSize:9, borderRadius:4, background:`${ev.color}22`, border:`1px solid ${ev.color}44`, color:ev.color, padding:"1px 4px", marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {ev.type === "exam" ? "💀 " : ""}{ev.code}
                      </div>
                    ))}
                    {evs.length > 2 && <div style={{ fontSize:9, color:C.muted }}>+{evs.length - 2}</div>}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── EXPORT ───────────────────────────────────────────────────────────────
function ExportView() {
  const [copied, setCopied] = useState(null);
  const exportOptions = [
    { id:"ical", icon:"📅", label:"iCal Export", desc:"Sync all deadlines to Apple Calendar, Google Calendar, or Outlook", color:C.cyan, badge:"Recommended" },
    { id:"csv", icon:"📊", label:"CSV / Excel", desc:"Download priority scores as a spreadsheet for custom analysis", color:C.green },
    { id:"notion", icon:"📋", label:"Notion Sync", desc:"Push all tasks and priorities directly to your Notion workspace", color:C.violet },
    { id:"share", icon:"🔗", label:"Share Link", desc:"Generate a read-only link others can use to view your semester", color:C.amber },
    { id:"pdf", icon:"📄", label:"PDF Report", desc:"Export a formatted priority report as a printable PDF", color:C.blue },
    { id:"api", icon:"⚡", label:"API Webhook", desc:"Get notified via Slack or Discord when high-priority deadlines approach", color:C.red },
  ];
  return (
    <div>
      <h2 style={{ ...display, fontSize:24, fontWeight:700, color:C.fg, marginBottom:4 }}>
        <GlowText gradient={`${C.green},${C.blue}`}>Export & Sync</GlowText>
      </h2>
      <MonoTag style={{ display:"block", marginBottom:24 }}>Push your semester data anywhere</MonoTag>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:28 }}>
        {exportOptions.map(opt => (
          <TiltCard key={opt.id} glowColor={opt.color} style={{ padding:20, cursor:"pointer" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
              <span style={{ fontSize:24 }}>{opt.icon}</span>
              {opt.badge && <span style={{ ...mono, fontSize:9, letterSpacing:"0.1em", background:`${opt.color}22`, border:`1px solid ${opt.color}44`, color:opt.color, borderRadius:99, padding:"2px 8px" }}>{opt.badge}</span>}
            </div>
            <div style={{ ...display, fontWeight:700, fontSize:15, color:C.fg, marginBottom:4 }}>{opt.label}</div>
            <div style={{ fontSize:12, color:C.muted, lineHeight:1.5, marginBottom:14 }}>{opt.desc}</div>
            <button onClick={() => { setCopied(opt.id); setTimeout(()=>setCopied(null),2000); }} style={{ width:"100%", background: copied === opt.id ? `${opt.color}33` : `${opt.color}18`, border:`1px solid ${opt.color}44`, borderRadius:8, padding:"8px 0", fontSize:12, color:opt.color, cursor:"pointer", transition:"all 0.2s", ...mono }}>
              {copied === opt.id ? "✓ Done!" : "Export →"}
            </button>
          </TiltCard>
        ))}
      </div>

      {/* Priority table preview */}
      <GlowingCard color={C.violet}>
        <div style={{ padding:20 }}>
          <div style={{ ...display, fontWeight:600, fontSize:15, color:C.fg, marginBottom:14 }}>Priority Report Preview</div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                  {["#","Course","Task","Type","Due","Score"].map(h => (
                    <th key={h} style={{ ...mono, fontSize:9, letterSpacing:"0.15em", textTransform:"uppercase", color:C.muted, textAlign:"left", padding:"6px 8px", fontWeight:400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scores.slice(0, 8).map((s, i) => (
                  <tr key={s.id} style={{ borderBottom:`1px solid ${C.border}` }}>
                    <td style={{ ...mono, fontSize:10, color:C.muted, padding:"8px" }}>#{i+1}</td>
                    <td style={{ padding:"8px", color:s.color, ...mono, fontSize:11 }}>{s.course_code}</td>
                    <td style={{ padding:"8px", color:C.fg, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontSize:12 }}>{s.title}</td>
                    <td style={{ padding:"8px", ...mono, fontSize:10, color:C.muted }}>{s.type}</td>
                    <td style={{ padding:"8px", ...mono, fontSize:10, color:C.muted }}>{s.date}</td>
                    <td style={{ padding:"8px", ...display, fontWeight:800, fontSize:16, color: s.score > 65 ? C.red : C.fg }}>{s.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </GlowingCard>
    </div>
  );
}

// ─── DASHBOARD ─────────────────────────────────────────────────────────────
function Dashboard({ setPage }) {
  const stats = [
    { label:"Deadlines", value: allEvents.length, color:C.cyan, icon:"📅" },
    { label:"Conflicts", value: CONFLICTS.length, color:C.red, icon:"⚠" },
    { label:"High weight", value: allEvents.filter(e=>(e.weight??0)>=20).length, color:C.amber, icon:"🎯" },
    { label:"Courses", value: COURSES.length, color:C.violet, icon:"📚" },
  ];
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div style={{ animation:"fadeUp 0.6s ease" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:C.violet, boxShadow:`0 0 10px ${C.violet}`, display:"inline-block" }} />
            <MonoTag>syllabus-bundle-fall-2026.pdf</MonoTag>
          </div>
          <h1 style={{ ...display, fontSize:36, fontWeight:800, color:C.fg, lineHeight:1.1 }}>
            Fall 2026 <GlowText>command center</GlowText>
          </h1>
        </div>
        <button onClick={() => setPage("calendar")} style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(167,139,250,0.12)", border:`1px solid ${C.violet}44`, borderRadius:10, padding:"10px 18px", fontSize:14, color:C.fg, cursor:"pointer", ...display, fontWeight:500 }}>
          Full calendar →
        </button>
      </div>

      {/* Stats bento */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Main bento */}
      <div style={{ display:"grid", gridTemplateColumns:"5fr 7fr", gap:14, marginBottom:80 }}>
        <GlowingCard color={C.violet} style={{ minHeight:440 }}>
          <div style={{ padding:20, height:"100%" }}>
            <div style={{ ...display, fontWeight:600, fontSize:15, color:C.fg, marginBottom:4 }}>Course Priority Board</div>
            <MonoTag style={{ display:"block", marginBottom:14 }}>Ranked by composite load</MonoTag>
            {COURSES.map((c, i) => {
              const load = scores.filter(s => s.course_id === c.id).reduce((sum, s) => sum + s.score, 0);
              return (
                <div key={c.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", borderRadius:10, background:"rgba(255,255,255,0.03)", border:`1px solid ${C.border}`, marginBottom:8 }}>
                  <div style={{ width:30, height:30, borderRadius:8, background:`${c.color}20`, display:"flex", alignItems:"center", justifyContent:"center", ...mono, fontSize:12, fontWeight:700, color:c.color }}>#{i+1}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ ...display, fontWeight:700, fontSize:13, color:C.fg }}>{c.code}</div>
                    <div style={{ display:"flex", gap:2 }}>{[1,2,3,4,5].map(n=><span key={n} style={{ fontSize:9, color: n<=c.diff ? C.amber : "rgba(255,255,255,0.1)" }}>★</span>)}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <MonoTag style={{ fontSize:8 }}>load</MonoTag>
                    <div style={{ ...display, fontSize:18, fontWeight:800, color:c.color }}><SplitFlap value={load} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </GlowingCard>
        <GlowingCard color={C.cyan} style={{ minHeight:440 }}>
          <div style={{ padding:20, height:"100%" }}>
            <ConflictRadarView />
          </div>
        </GlowingCard>
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("landing");
  const [activeTab, setActiveTab] = useState("dashboard");
  const pages = { dashboard:<Dashboard setPage={setActiveTab} />, courses:<CourseGrid />, radar:<ConflictRadarView />, calendar:<CalendarView />, export:<ExportView /> };

  return (
    <>
      <style>{STYLES}</style>
      <div style={{ background:C.bg, minHeight:"100vh", color:C.fg, fontFamily:"'Syne',system-ui,sans-serif", position:"relative" }}>
        <AuroraBackground />
        <SpotlightCursor />

        {page === "landing" ? (
          <LampHero onEnter={() => setPage("app")} />
        ) : (
          <div style={{ position:"relative", zIndex:2 }}>
            {/* Top bar */}
            <div style={{ position:"sticky", top:0, zIndex:50, background:"rgba(8,8,16,0.8)", borderBottom:`1px solid ${C.border}`, backdropFilter:"blur(20px)", padding:"12px 32px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <Sparkles count={4} style={{ display:"inline-block" }}>
                  <span style={{ ...display, fontSize:20, fontWeight:800, color:C.fg }}>plan<GlowText>IT</GlowText></span>
                </Sparkles>
                <div style={{ width:1, height:20, background:C.border }} />
                <MonoTag>Fall 2026 Mission Control</MonoTag>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ position:"relative", display:"inline-flex" }}>
                  <span style={{ position:"absolute", inset:0, borderRadius:"50%", background:C.green, animation:"ping 2s ease-out infinite", opacity:0.6 }} />
                  <span style={{ width:8, height:8, borderRadius:"50%", background:C.green, display:"inline-block", position:"relative" }} />
                </div>
                <MonoTag>All systems nominal</MonoTag>
              </div>
            </div>

            {/* Content */}
            <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 32px 120px" }}>
              {pages[activeTab] ?? pages.dashboard}
            </div>

            {/* Floating dock */}
            <FloatingDock active={activeTab} setActive={setActiveTab} />
          </div>
        )}
      </div>
    </>
  );
}