/**
 * Industry templates for the Service Businesses vertical.
 *
 * One schema serves every field-service business; what differs between an
 * auto-glass shop and a pool company is the catalogue of services, the
 * words on the job card, the routines and the SOPs. Those live here, as
 * data, so a new industry is a new entry — never new tables or pages.
 * Applied once at setup (lib/actions/services.ts → setupServices): the
 * catalogue lands in service_settings, the SOPs and policies in
 * service_docs, the routines in checklists. Everything stays editable.
 *
 * Client-safe: no imports.
 */

export type IndustryGroup = "automotive" | "home" | "outdoor" | "rental" | "trades" | "moving";

export interface CatalogItem {
  name: string;
  price: number;
  durationMin: number;
}

export interface SopTemplate {
  title: string;
  kind: "sop" | "policy" | "guide" | "faq";
  steps: string[];
}

export interface IndustryTemplate {
  id: string;
  label: string;
  group: IndustryGroup;
  /** What the primary noun is called on job cards: "vehicle", "property", "site". */
  site: string;
  /** Whether the technician travels (mobile) or the customer comes in. */
  mobile: boolean;
  catalog: CatalogItem[];
  /** Skills technicians can be tagged with, for assignment. */
  skills: string[];
  /** Industry-specific SOPs, appended to the shared ones. */
  sops: SopTemplate[];
  /** The checklist a technician runs on every job. */
  jobChecklist: string[];
}

export const INDUSTRY_GROUPS: Record<IndustryGroup, string> = {
  automotive: "Automotive",
  home: "Home services",
  outdoor: "Outdoor & property",
  rental: "Rental & hauling",
  trades: "Trades",
  moving: "Moving & construction",
};

/**
 * The SOPs every service business starts with — the lead-to-review loop
 * from the product brief. Industry entries add their own after these.
 */
export const SHARED_SOPS: SopTemplate[] = [
  {
    title: "Lead to review — the standard job loop",
    kind: "sop",
    steps: [
      "Lead arrives (call, text, Messenger, website form) → log it as a customer with source",
      "Call the customer back within 15 minutes during business hours",
      "Schedule an inspection or estimate visit; confirm address and access",
      "Generate the estimate in HostOS and send it the same day",
      "Follow up on the estimate after 2 days if there is no answer",
      "On approval: convert to a work order, assign a technician, book the calendar slot",
      "Send the customer an SMS reminder the day before and when the technician is en route",
      "Complete the work; capture before/after photos, materials, labor hours and a signature",
      "Collect payment and mark the job completed",
      "Request a Google review within 24 hours",
      "Follow up after 30 days to check satisfaction and offer maintenance",
    ],
  },
  {
    title: "Missed-call and after-hours policy",
    kind: "policy",
    steps: ["Every missed call gets a text back within 5 minutes: 'Sorry we missed you — how can we help?'", "After hours: the VA on duty logs the lead and books the callback for the next morning", "Emergency requests are forwarded to the on-call technician's phone"],
  },
  {
    title: "Cancellation and no-show policy",
    kind: "policy",
    steps: ["Cancellations more than 24 hours ahead: no charge, offer to reschedule", "Inside 24 hours: a trip fee may apply — quote it before confirming", "Customer not home: wait 15 minutes, call twice, photograph the door, then mark no-show"],
  },
  {
    title: "Photo standard for every job",
    kind: "guide",
    steps: ["Before: wide shot of the area plus close-ups of the problem", "During: anything the customer should know about (hidden damage, extra work)", "After: same angles as before, plus the serial/label of any part installed", "Upload from the job card before leaving the site"],
  },
  {
    title: "How a Virtual Assistant works this business",
    kind: "guide",
    steps: ["Morning: open the dispatch board, confirm every job for today has a technician and a time", "Text every customer their arrival window", "Work the estimate list: follow up anything sent more than 2 days ago", "Log every call, text and message on the customer's timeline", "End of day: check completed jobs for missing photos or signatures and chase them", "File anything that needs the owner as a task with a due date"],
  },
];

export const SHARED_JOB_CHECKLIST = ["Customer confirmed the appointment", "Address and access verified", "Before photos taken", "Work completed to scope", "After photos taken", "Materials and labor logged", "Customer signed off", "Payment collected", "Review requested"];

const auto = (id: string, label: string, catalog: CatalogItem[], skills: string[], sops: SopTemplate[] = [], mobile = true): IndustryTemplate => ({
  id,
  label,
  group: "automotive",
  site: "vehicle",
  mobile,
  catalog,
  skills,
  sops,
  jobChecklist: ["Vehicle year/make/model and plate recorded", ...SHARED_JOB_CHECKLIST],
});

const home = (id: string, label: string, catalog: CatalogItem[], skills: string[], sops: SopTemplate[] = [], group: IndustryGroup = "home"): IndustryTemplate => ({
  id,
  label,
  group,
  site: "property",
  mobile: true,
  catalog,
  skills,
  sops,
  jobChecklist: [...SHARED_JOB_CHECKLIST, "Site left clean"],
});

export const INDUSTRIES: IndustryTemplate[] = [
  // ------------------------------------------------------- automotive
  auto("auto_glass", "Automotive Glass Repair", [
    { name: "Windshield chip repair", price: 89, durationMin: 45 },
    { name: "Windshield replacement", price: 349, durationMin: 120 },
    { name: "Side / rear glass replacement", price: 279, durationMin: 90 },
    { name: "ADAS recalibration", price: 199, durationMin: 60 },
  ], ["windshield", "ADAS calibration", "tempered glass"], [
    { title: "Windshield replacement — safe drive-away time", kind: "sop", steps: ["Confirm glass part number against the VIN before dispatch", "Check for ADAS cameras — book recalibration in the same visit", "Adhesive cure: tell the customer the safe drive-away time in writing", "Photograph the old glass's damage and the new part's label"] },
  ]),
  auto("mobile_mechanic", "Mobile Mechanics", [
    { name: "Diagnostic", price: 99, durationMin: 60 },
    { name: "Oil change", price: 89, durationMin: 45 },
    { name: "Brake pads & rotors (per axle)", price: 289, durationMin: 120 },
    { name: "Battery replacement", price: 189, durationMin: 45 },
    { name: "Pre-purchase inspection", price: 149, durationMin: 90 },
  ], ["diagnostics", "brakes", "electrical", "engine", "hybrid/EV"], [
    { title: "Diagnostic-first policy", kind: "policy", steps: ["Every unknown fault starts with a paid diagnostic; the fee is credited if we do the repair", "Quote parts + labor in writing before touching anything beyond the diagnostic", "Parts warranty and labor warranty stated on every invoice"] },
  ]),
  auto("auto_detailing", "Auto Detailing", [
    { name: "Express interior + exterior", price: 129, durationMin: 90 },
    { name: "Full detail", price: 249, durationMin: 180 },
    { name: "Paint correction (1 step)", price: 399, durationMin: 300 },
    { name: "Ceramic coating", price: 899, durationMin: 480 },
  ], ["interior", "paint correction", "ceramic"], []),
  auto("mobile_tire", "Mobile Tire Services", [
    { name: "Flat repair", price: 49, durationMin: 30 },
    { name: "Tire change (per tire)", price: 35, durationMin: 20 },
    { name: "New tires — supply & fit (per tire)", price: 160, durationMin: 25 },
    { name: "Balance & rotation", price: 79, durationMin: 45 },
  ], ["TPMS", "balancing", "run-flat"], []),
  auto("towing", "Towing Companies", [
    { name: "Local tow (up to 10 mi)", price: 125, durationMin: 60 },
    { name: "Additional mileage (per mi)", price: 4, durationMin: 5 },
    { name: "Flatbed tow", price: 175, durationMin: 75 },
    { name: "Winch-out / recovery", price: 150, durationMin: 60 },
  ], ["flatbed", "wheel-lift", "heavy duty", "recovery"], [
    { title: "Dispatch priority for roadside calls", kind: "sop", steps: ["Highway and unsafe locations dispatch first", "Quote ETA on the call and text it; update if it slips by more than 10 minutes", "Photograph the vehicle from four sides before loading", "Confirm drop-off address and who receives the vehicle"] },
  ]),
  auto("roadside", "Roadside Assistance", [
    { name: "Jump start", price: 65, durationMin: 30 },
    { name: "Lockout", price: 75, durationMin: 30 },
    { name: "Fuel delivery (+ fuel)", price: 60, durationMin: 30 },
    { name: "Tire change", price: 65, durationMin: 30 },
  ], ["lockout", "jump start", "tire change"], []),
  auto("window_tint", "Window Tint", [
    { name: "Full car tint (ceramic)", price: 399, durationMin: 180 },
    { name: "Front two windows", price: 149, durationMin: 60 },
    { name: "Windshield strip", price: 79, durationMin: 30 },
    { name: "Tint removal", price: 129, durationMin: 90 },
  ], ["ceramic film", "removal"], [], false),
  auto("mobile_car_wash", "Mobile Car Wash", [
    { name: "Exterior wash", price: 39, durationMin: 30 },
    { name: "Wash + interior vacuum", price: 69, durationMin: 50 },
    { name: "Fleet wash (per vehicle)", price: 29, durationMin: 20 },
  ], ["fleet", "waterless"], []),

  // ----------------------------------------------------------- home
  home("cleaning", "Cleaning Services", [
    { name: "Standard clean (2 bed)", price: 149, durationMin: 150 },
    { name: "Deep clean", price: 289, durationMin: 300 },
    { name: "Move-in / move-out clean", price: 349, durationMin: 360 },
    { name: "Recurring bi-weekly clean", price: 129, durationMin: 120 },
  ], ["deep clean", "move-out", "commercial"], [
    { title: "Recurring customer routine", kind: "sop", steps: ["Same team, same day and time every visit where possible", "Text the customer the night before with the arrival window", "Photograph each room on completion", "Log any damage found before starting"] },
  ]),
  home("pest_control", "Pest Control", [
    { name: "General pest treatment", price: 149, durationMin: 60 },
    { name: "Quarterly service plan (per visit)", price: 119, durationMin: 45 },
    { name: "Rodent exclusion", price: 399, durationMin: 180 },
    { name: "Termite inspection", price: 99, durationMin: 60 },
  ], ["rodents", "termites", "bed bugs", "wildlife"], [
    { title: "Chemical use and customer notice", kind: "policy", steps: ["Products used are listed on every job card with the EPA number", "Customer told re-entry time in writing", "Pets and children out of treated areas until dry"] },
  ]),
  home("appliance_repair", "Appliance Repair", [
    { name: "Diagnostic visit", price: 89, durationMin: 60 },
    { name: "Washer / dryer repair (labor)", price: 149, durationMin: 90 },
    { name: "Refrigerator repair (labor)", price: 179, durationMin: 90 },
    { name: "Dishwasher install", price: 149, durationMin: 90 },
  ], ["refrigeration", "laundry", "cooking", "sealed system"], []),
  home("handyman", "Handyman Services", [
    { name: "Hourly handyman", price: 85, durationMin: 60 },
    { name: "Half day (4 hours)", price: 320, durationMin: 240 },
    { name: "TV mount", price: 129, durationMin: 60 },
    { name: "Drywall patch", price: 149, durationMin: 90 },
  ], ["carpentry", "drywall", "assembly", "mounting"], []),
  home("locksmith", "Locksmiths", [
    { name: "Home lockout", price: 89, durationMin: 30 },
    { name: "Rekey (per lock)", price: 35, durationMin: 15 },
    { name: "Deadbolt install", price: 149, durationMin: 60 },
    { name: "Car key programming", price: 179, durationMin: 60 },
  ], ["residential", "automotive", "commercial", "safes"], [
    { title: "Identity check before any entry", kind: "policy", steps: ["Photo ID matching the address or vehicle registration, before the door is opened", "No ID: get written authorization from the owner or decline", "Log the ID type on the job card"] },
  ]),
  home("pool", "Pool Maintenance", [
    { name: "Weekly service (per visit)", price: 45, durationMin: 30 },
    { name: "Green-to-clean", price: 349, durationMin: 240 },
    { name: "Filter clean", price: 99, durationMin: 60 },
    { name: "Pump / equipment repair (labor)", price: 149, durationMin: 90 },
  ], ["chemistry", "equipment", "leak detection"], []),
  home("painting", "Painting Companies", [
    { name: "Interior — per room", price: 449, durationMin: 360 },
    { name: "Exterior — per sq ft", price: 3, durationMin: 5 },
    { name: "Cabinet refinishing", price: 1899, durationMin: 1440 },
  ], ["interior", "exterior", "cabinets", "spray"], [], "moving"),

  // -------------------------------------------------------- outdoor
  home("pressure_washing", "Pressure Washing", [
    { name: "Driveway", price: 149, durationMin: 90 },
    { name: "House wash (soft wash)", price: 299, durationMin: 150 },
    { name: "Deck / patio", price: 179, durationMin: 90 },
    { name: "Roof soft wash", price: 449, durationMin: 180 },
  ], ["soft wash", "surface cleaner", "roof"], [], "outdoor"),
  home("lawn_care", "Lawn Care", [
    { name: "Weekly mow (up to ¼ acre)", price: 45, durationMin: 30 },
    { name: "Fertilization program (per visit)", price: 69, durationMin: 20 },
    { name: "Aeration + overseed", price: 249, durationMin: 90 },
    { name: "Spring / fall clean-up", price: 199, durationMin: 120 },
  ], ["mowing", "fertilization", "irrigation"], [
    { title: "Weather and route policy", kind: "policy", steps: ["Rain day: the whole route shifts one day; text every customer by 7 am", "Routes grouped by neighbourhood; new customers slot into the nearest route day", "Gate codes and dog notes on the property card before the first visit"] },
  ], "outdoor"),
  home("landscaping", "Landscaping", [
    { name: "Design consultation", price: 149, durationMin: 90 },
    { name: "Mulch install (per yard)", price: 95, durationMin: 30 },
    { name: "Sod install (per sq ft)", price: 2, durationMin: 2 },
    { name: "Paver patio (per sq ft)", price: 22, durationMin: 20 },
  ], ["hardscape", "planting", "irrigation", "design"], [], "outdoor"),
  home("tree", "Tree Services", [
    { name: "Tree trimming (small)", price: 299, durationMin: 180 },
    { name: "Tree removal (medium)", price: 899, durationMin: 360 },
    { name: "Stump grinding", price: 199, durationMin: 60 },
    { name: "Emergency storm response", price: 499, durationMin: 240 },
  ], ["climber", "bucket truck", "crane", "stump grinder"], [
    { title: "Job-site safety", kind: "policy", steps: ["Drop zone taped and a ground person on every removal", "Utility lines checked and marked before the first cut", "Crew PPE photographed at start of day"] },
  ], "outdoor"),

  // --------------------------------------------------------- rental
  home("dumpster", "Dumpster Rental", [
    { name: "10-yard, 7 days", price: 349, durationMin: 45 },
    { name: "20-yard, 7 days", price: 449, durationMin: 45 },
    { name: "30-yard, 7 days", price: 549, durationMin: 45 },
    { name: "Extra day", price: 15, durationMin: 0 },
    { name: "Swap-out", price: 199, durationMin: 60 },
  ], ["roll-off", "CDL"], [
    { title: "Delivery and pickup routine", kind: "sop", steps: ["Confirm placement spot and overhead clearance with the customer the day before", "Photograph the placement (driveway protection boards if used)", "Book the pickup date on delivery; text a reminder 2 days before", "Weigh ticket photographed and attached for overage billing"] },
  ], "rental"),
  home("junk_removal", "Junk Removal", [
    { name: "Minimum load", price: 129, durationMin: 45 },
    { name: "¼ truck", price: 249, durationMin: 60 },
    { name: "½ truck", price: 399, durationMin: 90 },
    { name: "Full truck", price: 649, durationMin: 150 },
    { name: "Single item pickup", price: 99, durationMin: 30 },
  ], ["heavy lifting", "hazmat aware", "donation runs"], [], "rental"),
  home("portable_toilet", "Portable Toilet Rental", [
    { name: "Standard unit — monthly", price: 175, durationMin: 30 },
    { name: "Deluxe / flushable — monthly", price: 275, durationMin: 30 },
    { name: "Event unit — weekend", price: 125, durationMin: 30 },
    { name: "Extra service visit", price: 45, durationMin: 20 },
  ], ["route service", "delivery"], [
    { title: "Weekly service route", kind: "sop", steps: ["Every unit serviced on its route day; photo of the unit and the service log after", "Low supplies noted on the job card and restocked on the next visit", "Damaged units swapped within 24 hours"] },
  ], "rental"),

  // --------------------------------------------------------- trades
  home("hvac", "HVAC", [
    { name: "Diagnostic / service call", price: 99, durationMin: 60 },
    { name: "Seasonal tune-up", price: 129, durationMin: 60 },
    { name: "Capacitor replacement", price: 249, durationMin: 60 },
    { name: "System install (quote)", price: 0, durationMin: 480 },
  ], ["residential", "commercial", "mini-split", "EPA 608"], [
    { title: "Maintenance-plan visits", kind: "sop", steps: ["Spring (cooling) and fall (heating) visits booked 30 days ahead", "Checklist: filter, refrigerant pressures, capacitor, drain line, thermostat", "Recommendations quoted on the spot and left on the customer's timeline"] },
  ], "trades"),
  home("plumbing", "Plumbing", [
    { name: "Service call / diagnostic", price: 89, durationMin: 60 },
    { name: "Drain clearing", price: 199, durationMin: 90 },
    { name: "Water heater replacement (labor)", price: 599, durationMin: 240 },
    { name: "Faucet install", price: 179, durationMin: 60 },
  ], ["drains", "water heaters", "repipe", "gas"], [], "trades"),
  home("electrical", "Electrical Services", [
    { name: "Service call / diagnostic", price: 99, durationMin: 60 },
    { name: "Outlet / switch install", price: 149, durationMin: 60 },
    { name: "Panel upgrade (quote)", price: 0, durationMin: 480 },
    { name: "EV charger install", price: 799, durationMin: 240 },
  ], ["residential", "panels", "EV chargers", "lighting"], [
    { title: "Permits and inspections", kind: "policy", steps: ["Panel, service and EV work is permitted before it starts; permit number on the job card", "Inspection booked when the work is completed; customer told the date", "Permit and inspection documents attached to the job"] },
  ], "trades"),
  home("roofing", "Roofing", [
    { name: "Roof inspection", price: 149, durationMin: 60 },
    { name: "Leak repair", price: 449, durationMin: 180 },
    { name: "Full replacement (per square)", price: 450, durationMin: 60 },
    { name: "Gutter install (per ft)", price: 12, durationMin: 5 },
  ], ["shingle", "metal", "flat/TPO", "insurance claims"], [
    { title: "Insurance-claim jobs", kind: "sop", steps: ["Inspection photos of every slope plus the damage, date-stamped", "Estimate in the insurer's line-item format", "Adjuster meeting booked as a job with the adjuster's name on it", "Supplement request filed within 3 days if scope changed"] },
  ], "trades"),

  // ------------------------------------------------ moving & construction
  home("moving", "Moving Companies", [
    { name: "2 movers + truck (per hour)", price: 149, durationMin: 60 },
    { name: "3 movers + truck (per hour)", price: 199, durationMin: 60 },
    { name: "Packing service (per hour)", price: 65, durationMin: 60 },
    { name: "Long-distance (quote)", price: 0, durationMin: 480 },
  ], ["packing", "piano", "long distance", "CDL"], [
    { title: "Move-day routine", kind: "sop", steps: ["Walk-through with the customer before loading; photograph pre-existing damage", "Inventory list signed at origin and destination", "Floor and door-frame protection before the first item moves", "Final walk-through and signature at destination"] },
  ], "moving"),
  home("construction", "Construction Contractors", [
    { name: "Site consultation", price: 0, durationMin: 90 },
    { name: "Project management (per week)", price: 1500, durationMin: 60 },
    { name: "Change order (admin)", price: 0, durationMin: 30 },
  ], ["framing", "concrete", "GC", "permits"], [
    { title: "Change-order policy", kind: "policy", steps: ["No scope change starts without a signed change order and price", "Daily photo log on the job card", "Weekly progress update sent to the customer every Friday"] },
  ], "moving"),
  home("renovation", "Home Renovation", [
    { name: "Design & scope visit", price: 149, durationMin: 120 },
    { name: "Kitchen remodel (quote)", price: 0, durationMin: 480 },
    { name: "Bathroom remodel (quote)", price: 0, durationMin: 480 },
    { name: "Flooring (per sq ft)", price: 6, durationMin: 5 },
  ], ["kitchens", "bathrooms", "flooring", "tile"], [], "moving"),
];

export function industryById(id: string | null | undefined): IndustryTemplate | undefined {
  return INDUSTRIES.find((i) => i.id === id);
}

export const INDUSTRY_LABELS: string[] = INDUSTRIES.map((i) => i.label);
