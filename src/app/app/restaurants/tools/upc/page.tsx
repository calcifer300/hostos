import type { Metadata } from "next";
import { UpcGenerator } from "@/components/restaurants/upc-generator";

export const metadata: Metadata = { title: "UPC generator" };

export default function UpcGeneratorPage() {
  return <UpcGenerator />;
}
