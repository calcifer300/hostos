"use client";

import { useEffect, useRef } from "react";
import { recordProposalView } from "@/lib/actions/proposals";

/**
 * Records that the client opened the proposal, once per page load, so the
 * sales board can show "sent but never opened" honestly. It sends the share
 * token — never an id — and nothing about the reader beyond the fact of the
 * open and which section they reached.
 */
export function ViewRecorder({ token }: { token: string }) {
  const sent = useRef(false);
  const deepest = useRef("hero");

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void recordProposalView(token, "opened");

    // How far they read, reported once when they leave.
    const sections = Array.from(document.querySelectorAll<HTMLElement>(".proposal-section[id]"));
    if (sections.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting && e.target.id) deepest.current = e.target.id;
      },
      { threshold: 0.4 }
    );
    sections.forEach((s) => io.observe(s));

    const report = () => {
      if (deepest.current && deepest.current !== "hero") void recordProposalView(token, `read to ${deepest.current}`);
    };
    window.addEventListener("pagehide", report, { once: true });

    return () => {
      io.disconnect();
      window.removeEventListener("pagehide", report);
    };
  }, [token]);

  return null;
}
