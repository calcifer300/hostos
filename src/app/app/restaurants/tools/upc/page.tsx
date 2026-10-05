import type { Metadata } from "next";
import { UpcGenerator } from "@/components/restaurants/upc-generator";
import { ModuleOff } from "@/components/dashboard/module-off";
import { verticalAccess } from "@/lib/host/context";

export const metadata: Metadata = { title: "UPC generator" };

export default async function UpcGeneratorPage() {
  // Belongs to the restaurants vertical: nothing here renders — or queries — unless this person may open it.
  const access = await verticalAccess("restaurants");
  if (access !== "ok") return <ModuleOff module="restaurants" reason={access} />;

  return <UpcGenerator />;
}
