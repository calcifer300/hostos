"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";
import { BookMarked, Bot, CheckCircle2, ListTodo, MessageSquareText, Search, Sparkles } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/marketing/sections";

const DRAFT =
  "Hi Maya — welcome! Pickup is at 9:30 AM at Park2Jet, row I. The lockbox is on the driver-side window; the code arrives here one hour before your trip. Please upload your license and a selfie in the Turo app before you arrive — keys can't be released until Turo confirms it. Safe travels!";

const SOURCES = [
  { label: "Knowledge base · Check-in process", tone: "text-accent" },
  { label: "Turo policy · Trip check-in guide for guests", tone: "text-accent-2" },
];

const SKILLS = [
  { icon: MessageSquareText, title: "Drafts replies", text: "Grounded in your house rules and Turo's policy, with sources shown." },
  { icon: ListTodo, title: "Generates tasks", text: "Turns an unverified license or a paused store into a task with a deadline and an owner." },
  { icon: Sparkles, title: "Briefs your morning", text: "One paragraph on what happened overnight and what to do first." },
  { icon: Search, title: "Answers policy questions", text: "Searches 725 Turo articles and cites the one that applies." },
  { icon: BookMarked, title: "Learns your voice", text: "Tone, structure and templates come from your knowledge base, not a generic model." },
  { icon: CheckCircle2, title: "Never sends on its own", text: "Every action stays a person's click. Escalations are flagged, not hidden." },
];

function useTypewriter(text: string, active: boolean, speed = 14) {
  // The visible length is the only state; the text itself is derived, so
  // nothing needs resetting inside the effect when `active` flips.
  const [length, setLength] = React.useState(0);
  React.useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setLength((n) => {
        if (n >= text.length) {
          clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, speed);
    return () => clearInterval(id);
  }, [text, active, speed]);
  return text.slice(0, length);
}

export function AiSection() {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  const typed = useTypewriter(DRAFT, inView);
  const done = typed.length === DRAFT.length;

  return (
    <section id="ai" className="scroll-mt-24 px-6 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="HostOS AI Butler"
          title={
            <>
              One assistant. <span className="text-gradient">Every surface.</span>
            </>
          }
          description="The Butler is the same brain behind fleet messaging, restaurant support, search, suggestions and task generation — so it knows your check-in process when it drafts a DoorDash reply, and your menu when it briefs your morning."
          align="center"
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_1fr]">
          <Reveal className="gradient-border relative overflow-hidden rounded-[1.5rem] border border-border bg-card p-6 shadow-[var(--shadow-elevated)] md:p-7">
            <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_100%_0%,color-mix(in_oklab,var(--accent-2)_18%,transparent),transparent_70%)]" />
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] text-white">
                  <Bot className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[13.5px] font-semibold">Butler</p>
                  <p className="text-[11px] text-muted-foreground">Drafting a reply · Maya · Tesla Model 3</p>
                </div>
              </div>
              <span className="rounded-full bg-success-bg px-2 py-0.5 text-[10.5px] font-medium text-success">Grounded</span>
            </div>

            <div className="rounded-xl border border-border bg-background/60 p-4">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Guest</p>
              <p className="text-[13.5px] text-foreground">
                &ldquo;Hi! First time renting — where do I pick up and do I need anything before?&rdquo;
              </p>
            </div>

            <div ref={ref} className="mt-3 rounded-xl border border-accent/30 bg-accent/5 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-accent">
                <Sparkles className="h-3 w-3" /> Draft reply
              </p>
              <p className="min-h-[96px] text-[13.5px] leading-relaxed text-foreground">
                {typed}
                {!done && <span className="ml-0.5 inline-block h-[14px] w-[2px] animate-pulse bg-accent align-middle" />}
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={done ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
              transition={{ duration: 0.45 }}
              className="mt-3 flex flex-wrap items-center gap-2"
            >
              <span className="text-[11px] text-muted-foreground">Sources</span>
              {SOURCES.map((s) => (
                <span key={s.label} className={`rounded-full border border-border bg-card px-2.5 py-1 text-[11px] ${s.tone}`}>
                  {s.label}
                </span>
              ))}
            </motion.div>
          </Reveal>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SKILLS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.05} className="spot rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
                <s.icon className="h-5 w-5 text-accent" strokeWidth={1.75} />
                <h3 className="mt-3 text-[14px] font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{s.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
