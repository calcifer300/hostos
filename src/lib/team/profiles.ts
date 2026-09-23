/**
 * The public "Our Team" roster — HostOS Collective's people, roles and
 * responsibilities, as shown on /team. Company-wide, not per workspace.
 *
 * DEFAULT_TEAM is ordered by responsibility — founder, technology, the
 * directors, then specialists and coordinators — without saying so; it is
 * what the page shows until the Founder saves the roster to the database (migration 0029, team_profiles); after that the database
 * is the source and this list is only the "restore defaults" option.
 *
 * Photos live at /public/team/<slug>.jpg (a 4:5 portrait, 900×1125,
 * produced by scripts/team-photos.mjs); the editor can point elsewhere.
 *
 * Client-safe: no imports.
 */

export type Department = "leadership" | "technology" | "operations" | "marketing" | "sales" | "content" | "support" | "finance" | "strategy" | "projects" | "data";

export interface DepartmentDefinition {
  label: string;
  /** Tile colour — the same idea as a vertical's hue on the chooser. */
  hue: string;
  /** Lucide icon name, resolved by the tile component. */
  icon: "Crown" | "Cpu" | "Settings2" | "Megaphone" | "Handshake" | "PenLine" | "Headset" | "Landmark" | "Lightbulb" | "FolderKanban" | "BarChart3";
}

export const DEPARTMENTS: Record<Department, DepartmentDefinition> = {
  leadership: { label: "Leadership", hue: "#0a84ff", icon: "Crown" },
  technology: { label: "Technology", hue: "#8b7cff", icon: "Cpu" },
  operations: { label: "Operations", hue: "#30d158", icon: "Settings2" },
  marketing: { label: "Marketing", hue: "#ff9f0a", icon: "Megaphone" },
  sales: { label: "Sales & Partnerships", hue: "#ff375f", icon: "Handshake" },
  content: { label: "Content", hue: "#40c8e0", icon: "PenLine" },
  support: { label: "Client Support", hue: "#c58a4f", icon: "Headset" },
  finance: { label: "Finance", hue: "#f59e0b", icon: "Landmark" },
  strategy: { label: "Strategy", hue: "#a78bfa", icon: "Lightbulb" },
  projects: { label: "Projects", hue: "#e14b6a", icon: "FolderKanban" },
  data: { label: "Research & Data", hue: "#1bdbdb", icon: "BarChart3" },
};

export const DEPARTMENT_IDS = Object.keys(DEPARTMENTS) as Department[];
export const asDepartment = (v: unknown): Department => ((DEPARTMENT_IDS as string[]).includes(String(v)) ? (v as Department) : "operations");

export interface TeamProfile {
  id: string;
  /** URL-safe handle, also the default photo filename (/team/<slug>.jpg). */
  slug: string;
  /** Full name — what the tile shows. */
  name: string;
  /** What everyone calls them; shown once a tile is opened. Falls back to the first name. */
  nickname: string | null;
  title: string;
  department: Department;
  /** Three short words the tile leads with: "Vision · Strategy · Growth". */
  focus: string[];
  /** The one-line promise on the tile. */
  quote: string;
  responsibilities: string[];
  photoUrl: string | null;
  /** Where the portrait is centred inside its frame, "x% y%" — set by the Founder so no face or hair is cut. */
  photoFocus: string;
  /** This person's own tile colour; falls back to the department's. */
  hue: string | null;
  /** Their sign-in, so the roster can link to the workspace member. Optional. */
  email: string | null;
  position: number;
  active: boolean;
}

const member = (slug: string, name: string, nickname: string, title: string, department: Department, hue: string, focus: string[], quote: string, responsibilities: string[]): TeamProfile => ({
  id: `default-${slug}`,
  slug,
  name,
  nickname,
  title,
  department,
  focus,
  quote,
  responsibilities,
  photoUrl: `/team/${slug}.jpg`,
  photoFocus: "50% 30%",
  hue,
  email: null,
  position: 0,
  active: true,
});

export const DEFAULT_TEAM: TeamProfile[] = [
  member("john", "John Briones", "John", "Founder", "leadership", "#0a84ff", ["Vision", "Strategy", "Growth"], "Leads the company toward a bigger future.", [
    "Sets the company's vision, mission and long-term goals",
    "Directs overall business strategy and priorities",
    "Builds key partnerships and client relationships",
    "Oversees company performance and sustainability",
    "Makes executive decisions and guides the leadership team",
    "Represents the company to clients, partners and the industry",
  ]),
  member("karl", "Karl Rodriguez", "Karl", "Platform Development", "technology", "#8b7cff", ["Technology", "Innovation", "AI"], "Builds the systems that power our success.", [
    "Leads technology strategy and infrastructure",
    "Oversees product development and architecture",
    "Manages integrations, automation and AI initiatives",
    "Ensures platform security, scalability and reliability",
    "Evaluates and implements new technologies",
    "Leads and mentors the engineering team",
  ]),
  member("gerald", "Gerald Ramirez", "Gerald", "Fleet Operations", "operations", "#30d158", ["Operations", "Client Success"], "Turns strategy into smooth daily operations.", [
    "Oversees day-to-day operations across all client accounts",
    "Ensures service quality and client satisfaction",
    "Manages onboarding, training and standard operating procedures",
    "Optimises processes and workflows",
    "Tracks performance and key metrics",
    "Leads and develops the operations team",
  ]),
  member("belle", "Maribel Magbual", "Belle", "Finance & Admin", "finance", "#f5b301", ["Finance", "Compliance", "Planning"], "Keeps our business strong and sustainable.", [
    "Manages invoicing and payments",
    "Tracks expenses and budgets",
    "Maintains financial records and reporting",
    "Manages contracts and subscriptions",
    "Ensures tax compliance and documentation",
    "Supports financial forecasting, payroll and planning with the CEO",
  ]),
  member("devie", "John Devie Ulanday", "Devie", "Growth", "marketing", "#ff9f0a", ["Marketing", "Brand", "Demand"], "Drives awareness and brings in opportunities.", [
    "Leads marketing strategy and campaigns",
    "Manages email, social media and content marketing",
    "Builds brand awareness and positioning",
    "Generates and nurtures qualified leads",
    "Develops marketing materials and sales enablement",
    "Analyses market trends and campaign performance",
  ]),
  member("red", "Givhine Leosala", "Red", "Partnerships", "sales", "#ff375f", ["Sales", "Partnerships", "Revenue"], "Builds relationships that create long-term value.", [
    "Identifies and reaches out to prospective clients",
    "Presents HostOS services and solutions",
    "Prepares proposals and contracts",
    "Negotiates and closes agreements",
    "Manages client onboarding handover",
    "Maintains and grows partner relationships",
  ]),
  member("loisa", "Loisa Celetaria", "Loisa", "Brand & Content", "content", "#40c8e0", ["Content", "Brand", "Community"], "Tells our story and keeps everyone connected.", [
    "Leads content creation and editorial standards",
    "Manages email templates and client communication",
    "Maintains the knowledge base and articles",
    "Oversees internal and external communications",
    "Supports marketing content and branding",
    "Ensures consistent messaging across every channel",
  ]),
  member("princess", "Princess Vergara", "Princess", "Customer Experience", "operations", "#5ac8fa", ["Scheduling", "Team Support"], "Keeps operations organised and on track.", [
    "Manages team schedules and calendars",
    "Coordinates client and team availability",
    "Assigns and monitors virtual-assistant tasks",
    "Tracks deadlines and deliverables",
    "Provides administrative support",
    "Handles escalations and schedule changes",
  ]),
  member("karu", "John Reigner Karunaratne", "Karu", "Product Strategy", "strategy", "#af52de", ["Strategy", "Process Improvement"], "Finds new ways to grow and do better.", [
    "Leads ideation and strategy development",
    "Identifies new verticals and markets",
    "Researches market opportunities",
    "Proposes process improvements",
    "Supports innovation and expansion",
    "Collaborates with leadership on special projects",
  ]),
  member("david", "David Briones", "David", "Research & Analytics", "data", "#1bdbdb", ["Research", "Data", "Insights"], "Turns data into actionable opportunities.", [
    "Conducts market research and competitor analysis",
    "Builds and maintains lead lists",
    "Handles data entry and database management",
    "Prepares reports and performance insights",
    "Supports client research requests",
    "Maintains data accuracy and quality",
  ]),
  member("ayie", "Mariel Briones", "Ayie", "Client Experience", "support", "#c58a4f", ["Client Care", "Resolution", "Satisfaction"], "Supports our clients and helps them succeed.", [
    "Provides research and data support",
    "Assists with lead-list building",
    "Supports client communication and follow-ups",
    "Documents processes and administrative work",
    "Escalates and resolves client issues",
    "Ensures client satisfaction and retention",
  ]),
  member("jb", "Jasper Briones", "JB", "Project Operations", "projects", "#ff6b6b", ["Projects", "Team Coordination"], "Connects people, moves projects forward.", [
    "Assists in project management",
    "Coordinates between teams and clients",
    "Tracks tasks, deadlines and deliverables",
    "Supports process documentation",
    "Maintains internal systems and tools",
    "Ensures projects are delivered on time",
  ]),
].map((m, i) => ({ ...m, position: i }));

/** The Founder's slug: the one tile with the seal. */
export const FOUNDER_SLUG = "john";
export const isFounderProfile = (m: Pick<TeamProfile, "slug" | "title">): boolean => m.slug === FOUNDER_SLUG || /^founder(\s*[&,]|\s+and\b|\s*$)/i.test(m.title);

/** What to call someone in a sentence: their nickname, else their first name. */
export const shortName = (m: Pick<TeamProfile, "name" | "nickname">): string => m.nickname?.trim() || m.name.trim().split(/\s+/)[0] || m.name;

/** The colour a tile wears: the person's own, else the department's. */
export const hueOf = (m: TeamProfile): string => m.hue ?? DEPARTMENTS[m.department].hue;

export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
