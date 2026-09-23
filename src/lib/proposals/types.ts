/**
 * The proposal document.
 *
 * A proposal is one JSON value so the sales story can grow without a
 * migration every time, and so a proposal can be duplicated, versioned and
 * re-priced per client. Everything here is editable per proposal; the
 * defaults in content.ts are the house story a new proposal starts from.
 *
 * Every read goes through normalizeProposal(), which makes any stored value
 * whole: a proposal written last month still renders after a field is added.
 *
 * Deliberately NOT server-only: the toolbar and the editor are client
 * components and need the status list and the document shape. Nothing here
 * touches a secret — it is types, constants and pure functions.
 */

export type ProposalStatus = "draft" | "sent" | "viewed" | "won" | "lost";
export const PROPOSAL_STATUSES: ProposalStatus[] = ["draft", "sent", "viewed", "won", "lost"];

export const STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  won: "Won",
  lost: "Lost",
};

/** The client this proposal is written for, and the branding it wears. */
export interface ProposalClient {
  company: string;
  contact: string;
  email: string;
  industry: string;
  /** The client's logo, shown beside ours on the cover. */
  logoUrl: string;
  /** A hex accent that re-tints the whole proposal to the client's brand. */
  accent: string;
}

export interface Cta {
  label: string;
  href: string;
}

export interface Hero {
  eyebrow: string;
  line1: string;
  line2: string;
  body: string;
  ctas: Cta[];
  /** The four figures under the ask. */
  figures: { value: string; label: string }[];
}

export interface Summary {
  title: string;
  lede: string;
  /** What is costing them money today. */
  losses: { name: string; body: string }[];
  /** How we answer each one. */
  answer: string;
}

/** An outcome card: not a feature, a result. */
export interface Outcome {
  id: string;
  name: string;
  problem: string;
  current: string;
  solution: string;
  impact: string;
  roi: string;
}

/** One screen of the product tour. */
export interface TourModule {
  id: string;
  name: string;
  line: string;
  how: string;
  before: string;
  after: string;
  timeSaved: string;
  costSaved: string;
  /** Placeholders until the real capture is uploaded. */
  image: string;
  video: string;
  demoHref: string;
}

export interface IndustrySolution {
  id: string;
  name: string;
  line: string;
  problems: string[];
  solutions: string[];
  automations: string[];
  va: string[];
  reporting: string;
  roi: string;
}

export interface Automation {
  id: string;
  name: string;
  trigger: string;
  steps: string[];
  outcome: string;
  saves: string;
}

export interface HumanRole {
  name: string;
  body: string;
}

export interface SoftwareCapability {
  name: string;
  body: string;
}

export interface CaseStudy {
  id: string;
  client: string;
  industry: string;
  challenge: string;
  implementation: string[];
  results: { value: string; label: string }[];
  hoursSaved: string;
  revenue: string;
  response: string;
  automations: string;
  timeline: string;
  roi: string;
  image: string;
  video: string;
}

export interface GalleryItem {
  id: string;
  name: string;
  body: string;
  duration: string;
  thumb: string;
  video: string;
}

export interface PricingTier {
  id: string;
  name: string;
  forWho: string;
  price: string;
  period: string;
  note: string;
  vaHours: string;
  automations: string;
  devHours: string;
  reporting: string;
  meetings: string;
  support: string;
  sla: string;
  roi: string;
  included: string[];
  featured: boolean;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface RoadmapStep {
  week: string;
  name: string;
  body: string;
  deliverables: string[];
}

export interface ProposalDoc {
  client: ProposalClient;
  hero: Hero;
  summary: Summary;
  outcomes: Outcome[];
  tour: TourModule[];
  industries: IndustrySolution[];
  automations: Automation[];
  humanOps: { lede: string; roles: HumanRole[]; why: string };
  software: { lede: string; capabilities: SoftwareCapability[]; stack: string[] };
  caseStudies: CaseStudy[];
  gallery: GalleryItem[];
  beforeAfter: { before: string[]; after: string[] };
  roadmap: RoadmapStep[];
  pricing: { lede: string; tiers: PricingTier[]; footnote: string };
  philosophy: { title: string; body: string; points: { name: string; body: string }[] };
  faq: FaqItem[];
  finalCta: { title: string; body: string };
}

export interface ProposalRow {
  id: string;
  title: string;
  clientCompany: string;
  clientContact: string;
  clientEmail: string;
  industry: string;
  status: ProposalStatus;
  doc: ProposalDoc;
  notes: string;
  shareToken: string | null;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalEvent {
  kind: string;
  detail: string;
  at: string;
}

/* ------------------------------------------------------------- normalizing */

const str = (v: unknown, fallback = "", max = 4000): string => {
  const s = typeof v === "string" ? v.trim() : "";
  return (s || fallback).slice(0, max);
};

const list = (v: unknown, fallback: string[], max = 40): string[] => {
  if (!Array.isArray(v)) return fallback;
  const out = v.map((x) => str(x, "", 600)).filter(Boolean).slice(0, max);
  return out.length ? out : fallback;
};

/** Rows of objects: kept only when the stored value is an array, each row made whole against the matching default. */
function rows<T>(v: unknown, fallback: T[], make: (raw: Record<string, unknown>, i: number) => T, max = 40): T[] {
  if (!Array.isArray(v) || v.length === 0) return fallback;
  return v.slice(0, max).map((raw, i) => make((raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>, i));
}

const HEX = /^#[0-9a-f]{6}$/i;

export function isProposalStatus(v: unknown): v is ProposalStatus {
  return typeof v === "string" && (PROPOSAL_STATUSES as string[]).includes(v);
}

/**
 * A URL we are willing to render inside a proposal: our own Supabase storage,
 * an https image or video, or nothing. Never javascript: or data:.
 */
export function isMediaSrc(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (!s) return true;
  return /^https:\/\//i.test(s) || s.startsWith("/");
}

const media = (v: unknown, fallback = ""): string => (isMediaSrc(v) ? String(v).trim() : fallback);

export function normalizeProposal(input: unknown, base: ProposalDoc): ProposalDoc {
  const d = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const obj = (k: string) => (d[k] && typeof d[k] === "object" ? (d[k] as Record<string, unknown>) : {});

  const c = obj("client");
  const hero = obj("hero");
  const summary = obj("summary");
  const humanOps = obj("humanOps");
  const software = obj("software");
  const beforeAfter = obj("beforeAfter");
  const pricing = obj("pricing");
  const philosophy = obj("philosophy");
  const finalCta = obj("finalCta");

  return {
    client: {
      company: str(c.company, base.client.company, 120),
      contact: str(c.contact, base.client.contact, 120),
      email: str(c.email, base.client.email, 160),
      industry: str(c.industry, base.client.industry, 80),
      logoUrl: media(c.logoUrl, base.client.logoUrl),
      accent: HEX.test(String(c.accent ?? "")) ? String(c.accent) : base.client.accent,
    },
    hero: {
      eyebrow: str(hero.eyebrow, base.hero.eyebrow, 120),
      line1: str(hero.line1, base.hero.line1, 120),
      line2: str(hero.line2, base.hero.line2, 120),
      body: str(hero.body, base.hero.body, 700),
      ctas: rows(hero.ctas, base.hero.ctas, (r, i) => ({
        label: str(r.label, base.hero.ctas[i]?.label ?? "", 60),
        href: str(r.href, base.hero.ctas[i]?.href ?? "#", 400),
      }), 4),
      figures: rows(hero.figures, base.hero.figures, (r, i) => ({
        value: str(r.value, base.hero.figures[i]?.value ?? "", 24),
        label: str(r.label, base.hero.figures[i]?.label ?? "", 80),
      }), 6),
    },
    summary: {
      title: str(summary.title, base.summary.title, 160),
      lede: str(summary.lede, base.summary.lede, 900),
      losses: rows(summary.losses, base.summary.losses, (r, i) => ({
        name: str(r.name, base.summary.losses[i]?.name ?? "", 90),
        body: str(r.body, base.summary.losses[i]?.body ?? "", 500),
      }), 10),
      answer: str(summary.answer, base.summary.answer, 900),
    },
    outcomes: rows(d.outcomes, base.outcomes, (r, i) => {
      const f = base.outcomes[i] ?? base.outcomes[0];
      return {
        id: str(r.id, f.id, 40),
        name: str(r.name, f.name, 90),
        problem: str(r.problem, f.problem, 400),
        current: str(r.current, f.current, 400),
        solution: str(r.solution, f.solution, 500),
        impact: str(r.impact, f.impact, 400),
        roi: str(r.roi, f.roi, 200),
      };
    }, 16),
    tour: rows(d.tour, base.tour, (r, i) => {
      const f = base.tour[i] ?? base.tour[0];
      return {
        id: str(r.id, f.id, 40),
        name: str(r.name, f.name, 60),
        line: str(r.line, f.line, 200),
        how: str(r.how, f.how, 600),
        before: str(r.before, f.before, 400),
        after: str(r.after, f.after, 400),
        timeSaved: str(r.timeSaved, f.timeSaved, 80),
        costSaved: str(r.costSaved, f.costSaved, 80),
        image: media(r.image, f.image),
        video: media(r.video, f.video),
        demoHref: str(r.demoHref, f.demoHref, 400),
      };
    }, 24),
    industries: rows(d.industries, base.industries, (r, i) => {
      const f = base.industries[i] ?? base.industries[0];
      return {
        id: str(r.id, f.id, 40),
        name: str(r.name, f.name, 60),
        line: str(r.line, f.line, 200),
        problems: list(r.problems, f.problems),
        solutions: list(r.solutions, f.solutions),
        automations: list(r.automations, f.automations),
        va: list(r.va, f.va),
        reporting: str(r.reporting, f.reporting, 400),
        roi: str(r.roi, f.roi, 200),
      };
    }, 16),
    automations: rows(d.automations, base.automations, (r, i) => {
      const f = base.automations[i] ?? base.automations[0];
      return {
        id: str(r.id, f.id, 40),
        name: str(r.name, f.name, 80),
        trigger: str(r.trigger, f.trigger, 200),
        steps: list(r.steps, f.steps, 8),
        outcome: str(r.outcome, f.outcome, 300),
        saves: str(r.saves, f.saves, 120),
      };
    }, 16),
    humanOps: {
      lede: str(humanOps.lede, base.humanOps.lede, 900),
      roles: rows(humanOps.roles, base.humanOps.roles, (r, i) => ({
        name: str(r.name, base.humanOps.roles[i]?.name ?? "", 80),
        body: str(r.body, base.humanOps.roles[i]?.body ?? "", 400),
      }), 16),
      why: str(humanOps.why, base.humanOps.why, 900),
    },
    software: {
      lede: str(software.lede, base.software.lede, 900),
      capabilities: rows(software.capabilities, base.software.capabilities, (r, i) => ({
        name: str(r.name, base.software.capabilities[i]?.name ?? "", 80),
        body: str(r.body, base.software.capabilities[i]?.body ?? "", 400),
      }), 16),
      stack: list(software.stack, base.software.stack, 24),
    },
    caseStudies: rows(d.caseStudies, base.caseStudies, (r, i) => {
      const f = base.caseStudies[i] ?? base.caseStudies[0];
      return {
        id: str(r.id, f.id, 40),
        client: str(r.client, f.client, 120),
        industry: str(r.industry, f.industry, 80),
        challenge: str(r.challenge, f.challenge, 700),
        implementation: list(r.implementation, f.implementation, 10),
        results: rows(r.results, f.results, (x, j) => ({
          value: str(x.value, f.results[j]?.value ?? "", 24),
          label: str(x.label, f.results[j]?.label ?? "", 80),
        }), 6),
        hoursSaved: str(r.hoursSaved, f.hoursSaved, 60),
        revenue: str(r.revenue, f.revenue, 60),
        response: str(r.response, f.response, 60),
        automations: str(r.automations, f.automations, 60),
        timeline: str(r.timeline, f.timeline, 80),
        roi: str(r.roi, f.roi, 200),
        image: media(r.image, f.image),
        video: media(r.video, f.video),
      };
    }, 12),
    gallery: rows(d.gallery, base.gallery, (r, i) => {
      const f = base.gallery[i] ?? base.gallery[0];
      return {
        id: str(r.id, f.id, 40),
        name: str(r.name, f.name, 80),
        body: str(r.body, f.body, 300),
        duration: str(r.duration, f.duration, 12),
        thumb: media(r.thumb, f.thumb),
        video: media(r.video, f.video),
      };
    }, 16),
    beforeAfter: {
      before: list(beforeAfter.before, base.beforeAfter.before, 12),
      after: list(beforeAfter.after, base.beforeAfter.after, 12),
    },
    roadmap: rows(d.roadmap, base.roadmap, (r, i) => {
      const f = base.roadmap[i] ?? base.roadmap[0];
      return {
        week: str(r.week, f.week, 40),
        name: str(r.name, f.name, 60),
        body: str(r.body, f.body, 500),
        deliverables: list(r.deliverables, f.deliverables, 8),
      };
    }, 8),
    pricing: {
      lede: str(pricing.lede, base.pricing.lede, 700),
      tiers: rows(pricing.tiers, base.pricing.tiers, (r, i) => {
        const f = base.pricing.tiers[i] ?? base.pricing.tiers[0];
        return {
          id: str(r.id, f.id, 40),
          name: str(r.name, f.name, 60),
          forWho: str(r.forWho, f.forWho, 160),
          price: str(r.price, f.price, 40),
          period: str(r.period, f.period, 40),
          note: str(r.note, f.note, 300),
          vaHours: str(r.vaHours, f.vaHours, 80),
          automations: str(r.automations, f.automations, 80),
          devHours: str(r.devHours, f.devHours, 80),
          reporting: str(r.reporting, f.reporting, 120),
          meetings: str(r.meetings, f.meetings, 120),
          support: str(r.support, f.support, 120),
          sla: str(r.sla, f.sla, 80),
          roi: str(r.roi, f.roi, 200),
          included: list(r.included, f.included, 16),
          featured: typeof r.featured === "boolean" ? r.featured : f.featured,
        };
      }, 6),
      footnote: str(pricing.footnote, base.pricing.footnote, 600),
    },
    philosophy: {
      title: str(philosophy.title, base.philosophy.title, 160),
      body: str(philosophy.body, base.philosophy.body, 900),
      points: rows(philosophy.points, base.philosophy.points, (r, i) => ({
        name: str(r.name, base.philosophy.points[i]?.name ?? "", 90),
        body: str(r.body, base.philosophy.points[i]?.body ?? "", 400),
      }), 10),
    },
    faq: rows(d.faq, base.faq, (r, i) => ({
      q: str(r.q, base.faq[i]?.q ?? "", 200),
      a: str(r.a, base.faq[i]?.a ?? "", 900),
    }), 20),
    finalCta: {
      title: str(finalCta.title, base.finalCta.title, 160),
      body: str(finalCta.body, base.finalCta.body, 600),
    },
  };
}
