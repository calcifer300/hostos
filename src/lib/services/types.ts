import type { CatalogItem } from "@/lib/services/industries";
import type { CustomerStage, EstimateStatus, EventKind, JobKind, JobPhoto, JobPriority, JobStatus, LineItem, Material, StaffRole } from "@/lib/services/analytics";

/** The Service Businesses vertical's records, as every page and widget sees them. Client-safe. */

export interface ServiceSettings {
  industry: string;
  businessName: string | null;
  timezone: string;
  defaultDurationMin: number;
  catalog: CatalogItem[];
  updatedAt: string;
}

export interface ServiceCustomer {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  stage: CustomerStage;
  source: string | null;
  tags: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceProperty {
  id: string;
  customerId: string;
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
  notes: string | null;
}

export interface ServiceStaff {
  id: string;
  name: string;
  role: StaffRole;
  email: string | null;
  phone: string | null;
  skills: string[];
  color: string | null;
  active: boolean;
}

export interface ServiceJob {
  id: string;
  number: number;
  customerId: string | null;
  propertyId: string | null;
  staffId: string | null;
  estimateId: string | null;
  kind: JobKind;
  title: string;
  description: string | null;
  status: JobStatus;
  priority: JobPriority;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  startedAt: string | null;
  completedAt: string | null;
  address: string | null;
  price: number | null;
  laborHours: number | null;
  materials: Material[];
  photos: JobPhoto[];
  signatureName: string | null;
  signedAt: string | null;
  recurrence: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceEstimate {
  id: string;
  number: number;
  customerId: string | null;
  propertyId: string | null;
  jobId: string | null;
  title: string;
  lineItems: LineItem[];
  subtotal: number;
  taxRate: number;
  total: number;
  status: EstimateStatus;
  sentAt: string | null;
  expiresAt: string | null;
  decidedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceEvent {
  id: string;
  customerId: string | null;
  jobId: string | null;
  kind: EventKind;
  body: string;
  createdBy: string | null;
  createdAt: string;
}

export interface ServiceDoc {
  id: string;
  kind: "sop" | "policy" | "guide" | "faq" | "handbook" | "training";
  title: string;
  body: string;
  position: number;
  updatedAt: string;
}

const STAGES: CustomerStage[] = ["lead", "customer", "inactive"];
export const asCustomerStage = (v: unknown): CustomerStage => ((STAGES as string[]).includes(String(v)) ? (v as CustomerStage) : "lead");

/** Everything the services dashboard and its pages read, assembled once per request. */
export interface ServicesData {
  settings: ServiceSettings | null;
  customers: ServiceCustomer[];
  staff: ServiceStaff[];
  jobs: ServiceJob[];
  estimates: ServiceEstimate[];
  docs: ServiceDoc[];
}

export const EMPTY_SERVICES: ServicesData = { settings: null, customers: [], staff: [], jobs: [], estimates: [], docs: [] };
