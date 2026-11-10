"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DECORATIVE_TILES, ECOSYSTEM_LOGOS, type EcosystemLogo } from "@/content/ecosystem";

interface Tile {
  key: string;
  name?: string;
  src?: string;
  color: string;
  background?: string;
  href?: string;
  layer: EcosystemLogo["layer"];
  decorative: boolean;
}

const LAYER = {
  foreground: { blur: 0, opacity: 1, scale: 1, trail: 1 },
  mid: { blur: 2.5, opacity: 0.7, scale: 0.85, trail: 0.6 },
  far: { blur: 7, opacity: 0.35, scale: 0.7, trail: 0.25 },
} as const;

const PERIOD_S = 48;
const rim = "inset 0 0 0 1px rgba(255,255,255,0.18)";
const gloss = "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 45%)";

function buildTiles(extra: { name: string; href: string }[]): Tile[] {
  const real: Tile[] = ECOSYSTEM_LOGOS.map((l, i) => ({ key: `eco-${i}`, ...l, decorative: false }));
  // Supported apps without an approved logo yet get a neutral monogram tile.
  const monos: Tile[] = extra
    .filter((e) => !ECOSYSTEM_LOGOS.some((l) => l.name === e.name))
    .map((e, i) => ({ key: `mono-${i}`, name: e.name, href: e.href, color: "#B8B8B8", layer: "foreground", decorative: false }));
  const tiles = [...real, ...monos];
  let i = 0;
  while (tiles.length < 4 && i < DECORATIVE_TILES.length) {
    tiles.push({ key: `deco-${i}`, ...DECORATIVE_TILES[i], decorative: true });
    i++;
  }
  return tiles;
}

function TileFace({ tile, size }: { tile: Tile; size: number }) {
  const bg = tile.background ?? "#161616";
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "22%",
        background: tile.src ? bg : `linear-gradient(145deg, ${tile.color}33, #161616 70%)`,
        boxShadow: `${rim}, 0 0 40px -8px ${tile.color}73`,
        position: "relative",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
      }}
    >
      {tile.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tile.src} alt="" width={size} height={size} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : tile.decorative ? (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 17c4 0 3-7 8-7s4 5 8 5" stroke={tile.color} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="19" cy="6" r="2" fill={tile.color} />
        </svg>
      ) : (
        <span className="font-display" style={{ fontSize: size * 0.42, fontWeight: 600, color: "#fff" }}>
          {tile.name?.slice(0, 1)}
        </span>
      )}
      <div style={{ position: "absolute", inset: 0, background: gloss, pointerEvents: "none" }} />
    </div>
  );
}

export default function OrbitHero({ apps }: { apps: { name: string; href: string }[] }) {
  const tiles = buildTiles(apps);
  const stageRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const trailRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hovered = useRef<number | null>(null);
  const [tip, setTip] = useState<number | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const n = tiles.length;
    // Evenly spread with a stable jitter so tiles never align.
    const starts = tiles.map((_, i) => (i / n) * Math.PI * 2 + (((i * 37) % 31) - 15) * (Math.PI / 180) * 0.8 - Math.PI / 2);
    let theta = 0;
    let speed = 1;
    let last = performance.now();
    let raf = 0;

    const layout = () => {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      const mobile = w < 640;
      const tablet = w < 1024;
      const size = mobile ? 52 : tablet ? 64 : 80;
      const trailLen = mobile ? 80 : tablet ? 120 : 160;
      // Centre the ellipse on the text block and keep every tile outside it
      // (text half-size plus tile radius plus 24px, scaled to pass the corners).
      const text = stage.parentElement?.querySelector("[data-orbit-text]") as HTMLElement | null;
      const sr = stage.getBoundingClientRect();
      const tr0 = text?.getBoundingClientRect();
      const cx = tr0 ? tr0.left - sr.left + tr0.width / 2 - w / 2 : 0;
      const cy = tr0 ? tr0.top - sr.top + tr0.height / 2 - h / 2 : 0;
      const hw = (tr0 ? tr0.width / 2 : 200) + size / 2 + 24;
      const hh = (tr0 ? tr0.height / 2 : 140) + size / 2 + 24;
      // Keep tiles on screen: the clearance ellipse is capped to the stage.
      const aMax = Math.abs(cx) < w / 2 ? w / 2 - size / 2 - 6 - Math.abs(cx) : w / 2;
      const bMax = h / 2 - size / 2 - 6 - Math.abs(cy);
      const a = Math.min(Math.max(Math.min(w * (mobile ? 0.4 : 0.42), 560), hw * 1.35), aMax);
      const b = Math.min(Math.max(Math.min(h * (mobile ? 0.34 : 0.38), 270), hh * 1.35), bMax);
      tiles.forEach((tile, i) => {
        const el = itemRefs.current[i];
        const tr = trailRefs.current[i];
        if (!el || !tr) return;
        const L = LAYER[tile.layer];
        const t = starts[i] + theta;
        const x = cx + a * Math.cos(t);
        const y = cy + b * Math.sin(t);
        const ang = Math.atan2(b * Math.cos(t), -a * Math.sin(t));
        const s = size * L.scale;
        el.style.width = `${s}px`;
        el.style.height = `${s}px`;
        const hov = hovered.current === i;
        el.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${(Math.sin(t * 2) * 15).toFixed(1)}deg) scale(${hov ? 1.12 : 1})`;
        tr.style.width = `${trailLen * (tile.layer === "foreground" ? 1 : 0.7)}px`;
        tr.style.height = `${s * 0.4}px`;
        tr.style.transform = `translate(0, -50%) rotate(${ang + Math.PI}rad)`;
        tr.style.opacity = String(hov ? 1 : L.trail * 0.7);
      });
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const target = hovered.current !== null ? 0.2 : 1;
      speed += (target - speed) * Math.min(dt / 0.4, 1);
      theta += ((Math.PI * 2) / PERIOD_S) * dt * speed;
      layout();
      raf = requestAnimationFrame(tick);
    };

    layout();
    if (reduced) {
      // Static: tiles at start angles, trails at 50%.
      trailRefs.current.forEach((t) => t && (t.style.opacity = "0.5"));
    } else {
      raf = requestAnimationFrame(tick);
    }
    const ro = new ResizeObserver(layout);
    ro.observe(stage);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // tiles is derived from props and module constants; rebuilt only when apps change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apps.length]);

  const setHover = (i: number | null) => {
    hovered.current = i;
    setTip(i);
  };

  return (
    <div ref={stageRef} className="orbit-stage absolute inset-0 overflow-hidden" aria-hidden={tiles.every((t) => t.decorative) ? true : undefined}>
      {tiles.map((tile, i) => {
        const L = LAYER[tile.layer];
        const interactive = !tile.decorative && tile.href;
        const external = Boolean(tile.href?.startsWith("http"));
        const face = <TileFace tile={tile} size={80} />;
        const Wrapper = external ? "a" : Link;
        return (
          <div
            key={tile.key}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className="orbit-item"
            style={{
              filter: L.blur ? `blur(${L.blur}px)` : undefined,
              opacity: L.opacity,
              zIndex: tile.layer === "foreground" ? 3 : tile.layer === "mid" ? 2 : 1,
              willChange: "transform",
            }}
          >
            <div
              ref={(el) => {
                trailRefs.current[i] = el;
              }}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transformOrigin: "0 50%",
                background: `linear-gradient(to right, ${tile.color}, transparent)`,
                filter: "blur(10px)",
                zIndex: -1,
                pointerEvents: "none",
              }}
            />
            {interactive ? (
              <Wrapper
                href={tile.href!}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                aria-label={`Open ${tile.name}`}
                className="block h-full w-full"
                style={{ borderRadius: "22%" }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              >
                <div style={{ width: "100%", height: "100%", transform: "scale(1)" }}>
                  <div style={{ width: "100%", height: "100%" }} className="[&>div]:!h-full [&>div]:!w-full">{face}</div>
                </div>
              </Wrapper>
            ) : (
              <div className="h-full w-full [&>div]:!h-full [&>div]:!w-full" aria-hidden>{face}</div>
            )}
            {tip === i && tile.name && (
              <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--n800)] px-3 py-1 text-xs font-medium text-white">
                {tile.name}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
