"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Check, Moon, Sun } from "lucide-react";
import { SKINS, writeSkin, type Skin } from "@/lib/skin";
import { useSkin } from "@/lib/use-skin";
import { cn } from "@/lib/utils";

/** True once on the client. The resolved colour mode is unknown on the server, so anything that draws from it waits. */
function useMounted(): boolean {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

/**
 * An ARIA radio group: one tab stop, arrow keys / Home / End move and select.
 *
 * Built from buttons rather than <input type="radio" name="…"> on purpose. React
 * restores a controlled radio by scanning every same-named radio in the
 * document and throws if one isn't React-managed — and streaming SSR leaves a
 * hidden, unhydrated duplicate of the page behind (div#S:0[hidden]), which is
 * exactly that. Native grouping made the first click on this card an uncaught
 * error; this has no `name` for React to find.
 */
function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  optionClassName,
  render,
}: {
  label: string;
  value: T;
  options: readonly { id: T }[];
  onChange: (next: T) => void;
  className?: string;
  optionClassName: string;
  render: (option: { id: T }, checked: boolean) => React.ReactNode;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const selected = Math.max(0, options.findIndex((o) => o.id === value));

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const step: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next = -1;
    if (event.key in step) next = (index + step[event.key] + options.length) % options.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    if (next < 0) return;
    event.preventDefault();
    onChange(options[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className={className}>
      {options.map((option, index) => {
        const checked = index === selected;
        return (
          <button
            key={option.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn("outline-none focus-visible:ring-2 focus-visible:ring-accent/60", optionClassName)}
          >
            {render(option, checked)}
          </button>
        );
      })}
    </div>
  );
}

const MODES = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
] as const;

interface Palette {
  content: string;
  side: string;
  card: string;
  line: string;
  accent: string;
}

/**
 * The colours each look really uses, written out here rather than read from the
 * page: a preview of the macOS look has to show the macOS look even while the
 * macOS look is switched off.
 */
function paletteFor(look: Skin, dark: boolean): Palette {
  if (look === "mac") {
    return dark
      ? { content: "#1e1e1e", side: "linear-gradient(160deg,#2c3b7c,#412a60)", card: "#2b2b2d", line: "rgba(255,255,255,0.14)", accent: "#0a84ff" }
      : { content: "#ececec", side: "linear-gradient(160deg,#cddfff,#eadbff)", card: "#ffffff", line: "rgba(0,0,0,0.14)", accent: "#007aff" };
  }
  return dark
    ? { content: "#09090b", side: "#0f0f12", card: "#131316", line: "#232329", accent: "#0a84ff" }
    : { content: "#dfe6ea", side: "#eef2f4", card: "#f4f7f8", line: "rgba(23,27,39,0.16)", accent: "#2c3ef3" };
}

/** A window in miniature: sidebar, selected row, two cards. */
function MiniWindow({ look, dark }: { look: Skin; dark: boolean }) {
  const p = paletteFor(look, dark);
  const mac = look === "mac";
  return (
    <div className="flex h-[88px] overflow-hidden" style={{ background: p.content, borderRadius: mac ? 8 : 12, boxShadow: `inset 0 0 0 0.5px ${p.line}` }} aria-hidden="true">
      <div className="flex w-[34%] flex-col gap-[5px] p-[7px]" style={{ background: p.side, borderRight: `0.5px solid ${p.line}` }}>
        {mac && (
          <div className="mb-[2px] flex gap-[3px]">
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
              <i key={c} className="block h-[6px] w-[6px] rounded-full" style={{ background: c }} />
            ))}
          </div>
        )}
        <div className="relative h-[9px] w-full" style={{ borderRadius: mac ? 3 : 5, background: mac ? p.accent : p.line }}>
          {!mac && <i className="absolute left-0 top-1/2 h-[6px] w-[2px] -translate-y-1/2 rounded-full" style={{ background: p.accent }} />}
        </div>
        {[70, 55, 62].map((w) => (
          <i key={w} className="block h-[5px] rounded-full" style={{ width: `${w}%`, background: p.line }} />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-[6px] p-[7px]">
        <i className="block h-[6px] w-1/3 rounded-full" style={{ background: p.line }} />
        <div className="flex flex-1 gap-[6px]">
          {[0, 1].map((n) => (
            <div key={n} className="flex-1" style={{ background: p.card, borderRadius: mac ? 6 : 9, boxShadow: `0 0 0 0.5px ${p.line}` }}>
              <i className="m-[6px] block h-[5px] w-1/2 rounded-full" style={{ background: n === 0 ? p.accent : p.line }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Settings → Appearance: the look (HostOS or macOS) and the mode (light or
 * dark). Both are personal and per browser, so nothing here is saved to the
 * workspace and nobody else sees a change made here.
 */
export function AppearanceCard() {
  const skin = useSkin();
  const mounted = useMounted();
  const { resolvedTheme, setTheme } = useTheme();
  const dark = mounted && resolvedTheme === "dark";

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]" aria-labelledby="appearance-heading">
      <p id="appearance-heading" className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        Appearance
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
        How HostOS looks on this device. It is yours alone — nothing here changes anything for the rest of your workspace.
      </p>

      <div className="mt-4">
        <p className="text-[12.5px] font-medium">Look</p>
        <ChoiceGroup
          label="Look"
          value={skin}
          options={SKINS}
          onChange={(next) => writeSkin(next)}
          className="mt-2 grid gap-3 sm:grid-cols-2"
          optionClassName="block rounded-xl border border-border p-2 text-left transition-colors hover:border-border-strong aria-checked:border-accent aria-checked:ring-2 aria-checked:ring-accent/30"
          render={(option, checked) => {
            const s = SKINS.find((k) => k.id === option.id)!;
            return (
              <>
                <MiniWindow look={s.id} dark={dark} />
                <span className="mt-2 flex items-center gap-1.5 text-[13px] font-medium">
                  {s.label}
                  {checked && <Check className="h-3.5 w-3.5 text-accent" aria-hidden="true" />}
                </span>
                <span className="block text-[12px] leading-relaxed text-muted-foreground">{s.hint}</span>
              </>
            );
          }}
        />
      </div>

      <div className="mt-5">
        <p className="text-[12.5px] font-medium">Mode</p>
        <ChoiceGroup
          label="Mode"
          value={dark ? "dark" : "light"}
          options={MODES}
          onChange={(next) => setTheme(next)}
          className="mt-2 inline-flex rounded-lg border border-border bg-muted p-0.5"
          optionClassName="flex h-7 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium text-muted-foreground transition-colors aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-sm"
          render={(option) => {
            const m = MODES.find((k) => k.id === option.id)!;
            return (
              <>
                <m.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {m.label}
              </>
            );
          }}
        />
      </div>
    </section>
  );
}
