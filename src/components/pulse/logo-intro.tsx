"use client";

import * as React from "react";

/**
 * The Colorado Cruisers reveal that plays every time the live page opens or loads.
 *
 * It is built in layers (background and spotlight, particles, mountains, the SUV with turning wheels and headlights,
 * the badge ring that draws itself, COLORADO, then CRUISERS landing with impact) and ends by dissolving into the real
 * logo artwork, so the last frame is the brand's own file, not a redraw. Plain SVG and the Web Animations API:
 * no animation library, 60 fps on a phone. Tap anywhere to skip. With reduced motion it shows the logo for a moment.
 */

const LOGO = "/brand/colorado-cruisers.webp";
const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 47 + 13) % 100, top: (i * 29 + 7) % 100, size: 1 + ((i * 3) % 3), delay: (i * 0.37) % 4, duration: 7 + ((i * 5) % 7),
}));

function ease(name: "out" | "inOut" | "back" | "soft") {
  return { out: "cubic-bezier(.16,.84,.32,1)", inOut: "cubic-bezier(.65,0,.35,1)", back: "cubic-bezier(.34,1.56,.64,1)", soft: "cubic-bezier(.22,.61,.36,1)" }[name];
}

export function LogoIntro({ onDone }: { onDone?: () => void }) {
  const root = React.useRef<HTMLDivElement>(null);
  const [gone, setGone] = React.useState(false);
  const finished = React.useRef(false);

  const finish = React.useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    const box = root.current;
    if (!box) { setGone(true); onDone?.(); return; }
    const out = box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, easing: "ease-out", fill: "forwards" });
    out.onfinish = () => { setGone(true); onDone?.(); };
  }, [onDone]);

  React.useEffect(() => {
    const box = root.current;
    if (!box) return;
    const q = (name: string) => box.querySelector<SVGElement | HTMLElement>(`[data-l="${name}"]`);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => { timers.push(window.setTimeout(fn, ms)); };
    const all: Animation[] = [];
    const go = (el: Element | null, frames: Keyframe[], options: KeyframeAnimationOptions) => {
      if (!el) return null;
      const animation = el.animate(frames, { fill: "both", ...options });
      all.push(animation);
      return animation;
    };

    const real = q("real");
    if (reduce) {
      go(real, [{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
      at(1400, finish);
      return () => { timers.forEach(window.clearTimeout); all.forEach((a) => a.cancel()); };
    }

    // 1. the room: black, then a soft spotlight
    go(q("particles"), [{ opacity: 0 }, { opacity: 1 }], { duration: 1500, delay: 200 });

    // 2. mountains rise, slightly blurred, then settle
    go(q("mountains"), [{ opacity: 0, transform: "translateY(40px)", filter: "blur(8px)" }, { opacity: 1, transform: "translateY(0)", filter: "blur(0)" }], { duration: 900, delay: 350, easing: ease("out") });
    go(q("disc"), [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 250 });

    // 3. the SUV drives in from the left: motion blur while fast, headlights on, wheels turning with the speed
    const drive = 1500;
    const start = 1000;
    go(q("suv"), [
      { transform: "translateX(-900px)", filter: "blur(9px)" },
      { transform: "translateX(18px)", filter: "blur(1.5px)", offset: 0.82 },
      { transform: "translateX(0)", filter: "blur(0)" },
    ], { duration: drive, delay: start, easing: ease("out") });
    go(q("suv-bounce"), [
      { transform: "translateY(0)" }, { transform: "translateY(5px)", offset: 0.35 }, { transform: "translateY(-3px)", offset: 0.65 }, { transform: "translateY(0)" },
    ], { duration: 650, delay: start + drive - 80, easing: "ease-in-out" });
    box.querySelectorAll<SVGElement>("[data-l=wheel]").forEach((wheel) => {
      go(wheel, [{ transform: "rotate(0deg)" }, { transform: "rotate(-1080deg)", offset: 0.82 }, { transform: "rotate(-1180deg)" }], { duration: drive + 400, delay: start, easing: ease("out") });
    });
    go(q("beam"), [{ opacity: 0 }, { opacity: 0.95, offset: 0.12 }, { opacity: 0.95, offset: 0.78 }, { opacity: 0.12 }], { duration: drive + 650, delay: start });
    go(q("rear-light"), [{ opacity: 0.4 }, { opacity: 1, offset: 0.85 }, { opacity: 0.7 }], { duration: drive + 400, delay: start });

    // 4. the badge draws itself, as if by an invisible pen
    const ring = q("ring") as SVGGeometryElement | null;
    const length = ring && "getTotalLength" in ring ? ring.getTotalLength() : 2400;
    if (ring) { ring.style.strokeDasharray = String(length); ring.style.strokeDashoffset = String(length); }
    go(ring, [{ strokeDashoffset: length }, { strokeDashoffset: 0 }], { duration: 1300, delay: start + drive - 300, easing: ease("inOut") });
    go(q("ring-inner"), [{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: start + drive + 600 });

    // 5. COLORADO slides up, with a shine
    const t1 = start + drive + 700;
    go(q("colorado"), [{ opacity: 0, transform: "translateY(26px)" }, { opacity: 1, transform: "translateY(-5px)", offset: 0.7 }, { opacity: 1, transform: "translateY(0)" }], { duration: 650, delay: t1, easing: ease("out") });
    go(q("shine1"), [{ transform: "translateX(-700px)" }, { transform: "translateX(700px)" }], { duration: 900, delay: t1 + 250, easing: "ease-in-out" });

    // 6. CRUISERS: the hero. scale in with impact, a shake on landing, a light sweep, a shadow pulse
    const t2 = t1 + 450;
    go(q("cruisers"), [
      { opacity: 0, transform: "translateY(24px) scale(.8)", filter: "blur(10px)" },
      { opacity: 1, transform: "translateY(-3px) scale(1.04)", filter: "blur(0)", offset: 0.6 },
      { opacity: 1, transform: "translateY(0) scale(1)", filter: "blur(0)" },
    ], { duration: 700, delay: t2, easing: ease("back") });
    go(q("land-shake"), [
      { transform: "translate(0,0)" }, { transform: "translate(-4px,3px)", offset: 0.2 }, { transform: "translate(3px,-2px)", offset: 0.4 }, { transform: "translate(-2px,1px)", offset: 0.6 }, { transform: "translate(0,0)" },
    ], { duration: 420, delay: t2 + 520, easing: "ease-out" });
    go(q("shine2"), [{ transform: "translateX(-760px)" }, { transform: "translateX(760px)" }], { duration: 1000, delay: t2 + 750, easing: "ease-in-out" });
    go(q("shadow-pulse"), [{ opacity: 0, transform: "scale(.7)" }, { opacity: 0.55, transform: "scale(1)", offset: 0.4 }, { opacity: 0, transform: "scale(1.3)" }], { duration: 900, delay: t2 + 520 });

    const t3 = t2 + 1500;
    // the spotlight fades up with the room and back out before the final artwork lands, so its black background sits on pure black
    const spotEnd = t3 + 400;
    go(q("spot"), [{ opacity: 0, transform: "scale(.8)", offset: 0 }, { opacity: 1, transform: "scale(1)", offset: 1400 / spotEnd }, { opacity: 1, transform: "scale(1)", offset: (t3 - 200) / spotEnd }, { opacity: 0, transform: "scale(1)", offset: 1 }], { duration: spotEnd, easing: "linear" });
    // 7. polish: a 2% push in, a white rim, and the real artwork dissolves in over the redraw
    go(q("stage"), [{ transform: "scale(1)" }, { transform: "scale(1.02)" }], { duration: 2800, delay: t3 - 900, easing: "linear" });
    go(q("rim"), [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: t3 - 300 });
    go(q("vector"), [{ opacity: 1 }, { opacity: 0 }], { duration: 650, delay: t3, easing: "ease-in-out" });
    go(real, [{ opacity: 0 }, { opacity: 1 }], { duration: 650, delay: t3, easing: "ease-in-out" });
    at(t3 + 2200, finish);

    // Development only: ?introAt=2300 freezes the reveal at that moment (milliseconds) so each frame can be looked at.
    if (process.env.NODE_ENV !== "production") {
      const frozen = Number(new URLSearchParams(window.location.search).get("introAt"));
      if (Number.isFinite(frozen) && frozen > 0) {
        timers.forEach(window.clearTimeout);
        all.forEach((a) => { a.pause(); a.currentTime = frozen; });
      }
    }

    return () => { timers.forEach(window.clearTimeout); all.forEach((a) => a.cancel()); };
  }, [finish]);

  if (gone) return null;
  return (
    <div ref={root} className="logo-intro" onClick={finish} role="presentation" aria-label="Colorado Cruisers">
      <div data-l="spot" className="logo-spot" />
      <div data-l="particles" className="logo-particles" aria-hidden>
        {PARTICLES.map((p, i) => (
          <i key={i} style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s` }} />
        ))}
      </div>
      <div data-l="stage" className="logo-stage">
        <div data-l="rim" className="logo-rim" />
        <svg data-l="vector" viewBox="0 0 1000 900" className="logo-svg" aria-hidden>
          <defs>
            <linearGradient id="li-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#b9bcc2" /></linearGradient>
            <linearGradient id="li-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset=".55" stopColor="#dfe1e5" /><stop offset="1" stopColor="#8d9097" /></linearGradient>
            <linearGradient id="li-shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".95" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
            <radialGradient id="li-beam" cx="1" cy=".5" r="1"><stop offset="0" stopColor="#fff" stopOpacity=".9" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
            <radialGradient id="li-fog" cx=".5" cy="1" r=".8"><stop offset="0" stopColor="#8a8d93" stopOpacity=".55" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
            <clipPath id="li-clip-cruisers"><text x="500" y="742" textAnchor="middle" className="li-cruisers-text" textLength="860" lengthAdjust="spacingAndGlyphs">CRUISERS</text></clipPath>
            <clipPath id="li-clip-colorado"><text x="500" y="590" textAnchor="middle" className="li-colorado-text" textLength="440" lengthAdjust="spacingAndGlyphs">COLORADO</text></clipPath>
            <clipPath id="li-disc"><circle cx="500" cy="438" r="398" /></clipPath>
          </defs>

          <g data-l="disc"><circle cx="500" cy="438" r="398" fill="#0e0e10" /><rect x="102" y="438" width="796" height="398" fill="url(#li-fog)" clipPath="url(#li-disc)" /></g>

          <g data-l="mountains" clipPath="url(#li-disc)">
            <g transform="translate(0 -20) scale(1 .768)">
              <polygon points="120,590 285,365 365,300 425,352 500,150 580,330 640,285 705,362 880,590" fill="#232326" />
              <polygon points="500,150 462,262 490,250 512,282 532,244 580,330 548,300" fill="#f2f3f5" />
              <polygon points="365,300 332,348 354,338 374,360 394,332 425,352" fill="#f2f3f5" />
              <polygon points="640,285 612,330 632,322 652,344 670,318 705,362" fill="#f2f3f5" />
              <polygon points="120,590 245,455 330,520 420,440 500,520 600,445 690,520 770,455 880,590" fill="#141416" />
              {[160, 200, 240, 728, 768, 808].map((x, i) => (<polygon key={x} points={`${x},560 ${x + 18},${470 - (i % 2) * 16} ${x + 36},560`} fill="#050506" />))}
            </g>
          </g>

          <circle data-l="ring" cx="500" cy="438" r="430" fill="none" stroke="#ffffff" strokeWidth="18" strokeLinecap="round" transform="rotate(-90 500 438)" />
          <circle data-l="ring-inner" cx="500" cy="438" r="406" fill="none" stroke="#8d9097" strokeWidth="4" />

          {/* the SUV, built from layers so its wheels can turn on their own */}
          <g transform="translate(150 246) scale(1.26 1.36)">
           <g data-l="suv">
            <g data-l="suv-bounce">
              <ellipse cx="290" cy="196" rx="270" ry="12" fill="#000" opacity=".45" />
              <g data-l="beam" opacity="0"><ellipse cx="-60" cy="108" rx="150" ry="46" fill="url(#li-beam)" /></g>
              <path d="M12 150 C10 128 24 114 56 108 L128 96 C158 50 198 28 262 24 L424 24 C462 26 494 46 516 84 L546 104 C560 112 562 134 558 156 L550 172 L30 174 Z" fill="url(#li-body)" stroke="#fff" strokeWidth="7" strokeLinejoin="round" paintOrder="stroke" />
              <path d="M12 150 C10 128 24 114 56 108 L128 96 C158 50 198 28 262 24 L424 24 C462 26 494 46 516 84 L546 104 C560 112 562 134 558 156 L550 172 L30 174 Z" fill="none" stroke="#0b0b0c" strokeWidth="3" />
              <polygon points="136,96 174,52 260,38 264,96" fill="#23262d" />
              <polygon points="278,96 276,38 414,40 486,96" fill="#23262d" />
              <rect x="266" y="36" width="9" height="62" fill="#cfd1d6" />
              <path d="M60 106 L520 106" stroke="#0b0b0c" strokeWidth="3" opacity=".5" />
              <ellipse cx="30" cy="124" rx="16" ry="7" fill="#fff" stroke="#0b0b0c" strokeWidth="2" />
              <rect x="544" y="124" width="10" height="22" rx="3" fill="#d62d2d" data-l="rear-light" />
              <rect x="40" y="148" width="80" height="12" rx="5" fill="#2a2d33" />
              <path d="M150 30 L430 30" stroke="#0b0b0c" strokeWidth="5" strokeLinecap="round" opacity=".7" />
              {[[150, 170], [478, 170]].map(([cx, cy]) => (
                <g key={cx}>
                  <circle cx={cx} cy={cy} r="50" fill="#0b0b0c" />
                  <g data-l="wheel" style={{ transformOrigin: `${cx}px ${cy}px`, transformBox: "view-box" }}>
                    <circle cx={cx} cy={cy} r="40" fill="#161618" stroke="#2c2c30" strokeWidth="4" />
                    <circle cx={cx} cy={cy} r="26" fill="#e9eaed" stroke="#0b0b0c" strokeWidth="3" />
                    {[0, 72, 144, 216, 288].map((deg) => (
                      <path key={deg} d={`M${cx} ${cy} L${cx} ${cy - 24}`} stroke="#0b0b0c" strokeWidth="6" strokeLinecap="round" transform={`rotate(${deg} ${cx} ${cy})`} />
                    ))}
                    <circle cx={cx} cy={cy} r="6" fill="#0b0b0c" />
                  </g>
                </g>
              ))}
            </g>
           </g>
          </g>

          <g data-l="land-shake">
            <g data-l="colorado" opacity="0">
              <rect x="70" y="566" width="170" height="5" fill="#fff" /><rect x="760" y="566" width="170" height="5" fill="#fff" />
              <text x="500" y="590" textAnchor="middle" className="li-colorado-text" textLength="440" lengthAdjust="spacingAndGlyphs" fill="#fff" stroke="#000" strokeWidth="10" paintOrder="stroke">COLORADO</text>
              <g clipPath="url(#li-clip-colorado)"><g transform="skewX(-20)"><rect data-l="shine1" x="300" y="540" width="260" height="70" fill="url(#li-shine)" /></g></g>
            </g>
            <g data-l="cruisers" opacity="0" style={{ transformOrigin: "500px 690px" }}>
              <ellipse data-l="shadow-pulse" cx="500" cy="760" rx="440" ry="40" fill="#fff" opacity="0" />
              <text x="506" y="750" textAnchor="middle" className="li-cruisers-text" textLength="860" lengthAdjust="spacingAndGlyphs" fill="#000" stroke="#000" strokeWidth="26">CRUISERS</text>
              <text x="500" y="742" textAnchor="middle" className="li-cruisers-text" textLength="860" lengthAdjust="spacingAndGlyphs" fill="#fff" stroke="#fff" strokeWidth="16" strokeLinejoin="round">CRUISERS</text>
              <text x="500" y="742" textAnchor="middle" className="li-cruisers-text" textLength="860" lengthAdjust="spacingAndGlyphs" fill="url(#li-metal)" stroke="#0b0b0c" strokeWidth="3">CRUISERS</text>
              <g clipPath="url(#li-clip-cruisers)"><g transform="skewX(-20)"><rect data-l="shine2" x="300" y="560" width="300" height="200" fill="url(#li-shine)" /></g></g>
            </g>
          </g>
        </svg>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img data-l="real" src={LOGO} alt="Colorado Cruisers" className="logo-real" draggable={false} />
      </div>
      <button type="button" className="logo-skip" onClick={(event) => { event.stopPropagation(); finish(); }}>Skip</button>
    </div>
  );
}
