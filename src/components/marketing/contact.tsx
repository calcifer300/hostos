"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Mail, MessageCircle, Phone, Send } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeading } from "@/components/marketing/sections";
import { CONTACT_INTERESTS } from "@/components/marketing/data";
import { submitContactRequest } from "@/lib/actions/contact";
import { SITE } from "@/lib/site";

export function Contact() {
  const [pending, startTransition] = React.useTransition();
  const [state, setState] = React.useState<{ ok: boolean; error?: string } | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await submitContactRequest(data);
      setState(result);
      if (result.ok) formRef.current?.reset();
    });
  }

  return (
    <section id="contact" className="scroll-mt-24 px-6 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <SectionHeading
            eyebrow="Get in touch"
            title={
              <>
                Let&rsquo;s build something <span className="text-gradient">great together.</span>
              </>
            }
            description="Whether you need a website, automation, virtual support, a custom system or just a free strategy call — tell us what you run and what's costing you time, and we'll come back with a plan."
            className="mb-8"
          />
          <Reveal delay={0.1} className="space-y-3">
            <a
              href={`mailto:${SITE.contactEmail}`}
              className="spot flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-[14px] shadow-[var(--shadow-card)] transition-[border-color,transform] duration-200 hover:border-accent/40 active:scale-[0.99]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent">
                <Mail className="h-4 w-4" />
              </span>
              {SITE.contactEmail}
            </a>
            <a
              href={SITE.whatsapp}
              target="_blank"
              rel="noreferrer"
              className="spot flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-[14px] shadow-[var(--shadow-card)] transition-[border-color,transform] duration-200 hover:border-accent/40 active:scale-[0.99]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success/10 text-success">
                <Phone className="h-4 w-4" />
              </span>
              <span>
                {SITE.phone} <span className="text-muted-foreground">(WhatsApp)</span>
              </span>
            </a>
            <Button asChild variant="secondary" size="lg" className="w-full justify-center">
              <a href={SITE.whatsappConsultation} target="_blank" rel="noreferrer">
                <MessageCircle className="text-success" /> Chat on WhatsApp
              </a>
            </Button>
            <p className="px-1 text-[12.5px] text-muted-foreground">Replies within one business day. Every engagement starts with a free strategy call.</p>
          </Reveal>
        </div>

        <Reveal y={24}>
          <form
            ref={formRef}
            onSubmit={onSubmit}
            className="gradient-border rounded-[1.5rem] border border-border bg-card p-6 shadow-[var(--shadow-elevated)] md:p-8"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" name="fullName" placeholder="Your name" required autoComplete="name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="you@company.com" required autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company">Company</Label>
                <Input id="company" name="company" placeholder="Optional" autoComplete="organization" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="interest">Service interested in</Label>
                <NativeSelect id="interest" name="interest" defaultValue="">
                  <option value="" disabled>
                    Select a service…
                  </option>
                  {CONTACT_INTERESTS.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" name="message" rows={5} placeholder="What do you run, and what would you like help with?" required />
              </div>
              {/* Honeypot — hidden from people, filled by bots. */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <AnimatePresence mode="wait">
                {state?.ok ? (
                  <motion.p
                    key="ok"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-[13px] text-success"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Sent — we&rsquo;ll be in touch.
                  </motion.p>
                ) : state?.error ? (
                  <motion.p key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[13px] text-danger">
                    {state.error}
                  </motion.p>
                ) : (
                  <span key="hint" className="text-[12px] text-muted-foreground">
                    No newsletters. No sharing. Just a reply.
                  </span>
                )}
              </AnimatePresence>
              <Button type="submit" variant="gradient" size="lg" loading={pending}>
                Send message
                <Send />
              </Button>
            </div>
          </form>
        </Reveal>
      </div>
    </section>
  );
}
